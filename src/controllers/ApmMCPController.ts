import { MCPController, VCategory } from '@kozen/engine';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { z } from 'zod';
import { PackageType, Provider, Scope } from '../models/provider.model';
import { findProjectRoot } from '../platform/system';
import type { ApmRegistryService }  from '../services/ApmRegistryService';
import type { ApmInstallerService } from '../services/ApmInstallerService';
import type { ApmLockService }      from '../services/ApmLockService';

/**
 * ApmMCPController — exposes APM actions as MCP tools for AI agents.
 *
 * Tool naming convention: kozen_apm_<action>
 * MCP config example (Claude Code / Cursor / VS Code):
 *
 *   { "command": "npx", "args": ["kozen", "--moduleLoad=@kozen/apm", "--type=mcp"],
 *     "env": { "KOZEN_LOG_LEVEL": "NONE" } }
 *
 * IMPORTANT — KZN-003 workaround:
 *   KOZEN_LOG_LEVEL=NONE must be set in the MCP server config to prevent
 *   console output from corrupting the JSON-RPC stdout stream.
 *   When KZN-003 is fixed upstream, this requirement will be automatic.
 */
export class ApmMCPController extends MCPController {

  // ── shared Zod schemas ────────────────────────────────────────────────────

  private static readonly componentSchema = z
    .enum(['skill', 'agent'])
    .default('skill')
    .describe('Component type to operate on');

  private static readonly providerSchema = z
    .enum(['standard', 'claude', 'cursor', 'vscode', 'windsurf'])
    .default('standard')
    .describe('AI tool provider to install into');

  private static readonly scopeSchema = z
    .enum(['local', 'global'])
    .default('local')
    .describe('Install scope: local (current project) or global (home directory)');

  private static readonly projectRootSchema = z
    .string()
    .optional()
    .describe('Absolute path to the project root. Auto-detected from CWD if omitted.');

  // ── register tools ────────────────────────────────────────────────────────

  public async register(server: McpServer): Promise<void> {

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore TS2589 — Zod+MCP generic inference exceeds TypeScript's depth limit; runtime is correct.
    server.registerTool(
      'kozen_apm_install',
      {
        description:
          'Install AI skills or agents into an AI tool provider ' +
          '(Claude Code, Cursor, VSCode, Windsurf, or a standard .agents/ directory). ' +
          'Leave packages empty to install all available packages of the given type.',
        inputSchema: {
          packages:    z.array(z.string()).optional()
                        .describe('Package names to install. Omit to install all available.'),
          component:   ApmMCPController.componentSchema,
          provider:    ApmMCPController.providerSchema,
          scope:       ApmMCPController.scopeSchema,
          projectRoot: ApmMCPController.projectRootSchema,
          dir:         z.string().optional().describe('Custom install directory (overrides scope path)'),
        },
      },
      this._install.bind(this),
    );

    server.registerTool(
      'kozen_apm_uninstall',
      {
        description:
          'Remove installed AI skills or agents from a provider. ' +
          'Leave packages empty to remove all installed packages at the given provider+scope.',
        inputSchema: {
          packages:    z.array(z.string()).optional()
                        .describe('Package names to remove. Omit to remove all.'),
          component:   ApmMCPController.componentSchema,
          provider:    ApmMCPController.providerSchema,
          scope:       ApmMCPController.scopeSchema,
          projectRoot: ApmMCPController.projectRootSchema,
          dir:         z.string().optional().describe('Custom install directory'),
        },
      },
      this._uninstall.bind(this),
    );

    server.registerTool(
      'kozen_apm_list',
      {
        description:
          'List all available AI packages (skills or agents) from the configured sources ' +
          '(local, github, npm). Returns name, group, description, and update date.',
        inputSchema: {
          component:   ApmMCPController.componentSchema,
          projectRoot: ApmMCPController.projectRootSchema,
        },
      },
      this._list.bind(this),
    );

    server.registerTool(
      'kozen_apm_status',
      {
        description:
          'Show all installed AI packages across every provider and scope, ' +
          'including whether each package is outdated.',
        inputSchema: {
          component:   ApmMCPController.componentSchema,
          projectRoot: ApmMCPController.projectRootSchema,
        },
      },
      this._status.bind(this),
    );

    server.registerTool(
      'kozen_apm_outdated',
      {
        description:
          'Return only the installed packages that have a newer version available ' +
          'in the source registry.',
        inputSchema: {
          component:   ApmMCPController.componentSchema,
          projectRoot: ApmMCPController.projectRootSchema,
        },
      },
      this._outdated.bind(this),
    );
  }

  // ── tool handlers ─────────────────────────────────────────────────────────

  private async _install(args: {
    packages?:    string[];
    component?:   string;
    provider?:    string;
    scope?:       string;
    projectRoot?: string;
    dir?:         string;
  }): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const flow = this.getId();
    try {
      const type      = (args.component ?? 'skill') as PackageType;
      const provider  = (args.provider  ?? 'standard') as Provider;
      const scope     = (args.scope     ?? 'local') as Scope;
      const pkgNames  = args.packages ?? [];

      await this.log({
        flow, src: 'APM:ApmMCPController:install',
        message: `Installing ${pkgNames.length || 'all'} ${type}(s) via ${provider}/${scope}`,
        category: VCategory.mcp.tool,
      });

      const registry  = await this.assistant?.resolve<ApmRegistryService>('apm:registry');
      const installer = await this.assistant?.resolve<ApmInstallerService>('apm:installer');
      const lockSvc   = await this.assistant?.resolve<ApmLockService>('apm:lock');

      const available = registry?.getAvailable(type) ?? [];
      const toInstall = pkgNames.length
        ? available.filter(p => pkgNames.includes(p.name))
        : available;

      if (!toInstall.length) {
        return this._text(`No matching ${type}s found. Run kozen_apm_list to see available packages.`);
      }

      const result = installer!.install(toInstall, provider, scope, args.dir);

      if (result.succeeded.length) {
        const installed = (registry?.getInstalled(type) ?? [])
          .filter(p => p.provider === provider && p.scope === scope);
        lockSvc?.mergeForTarget(installed, provider, scope);
      }

      return this._text(JSON.stringify({
        succeeded: result.succeeded,
        skipped:   result.skipped,
        errors:    result.errors,
        target:    result.target,
        elapsed:   result.elapsed,
      }, null, 2));

    } catch (err) {
      return this._error(err);
    }
  }

  private async _uninstall(args: {
    packages?:    string[];
    component?:   string;
    provider?:    string;
    scope?:       string;
    projectRoot?: string;
    dir?:         string;
  }): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const flow = this.getId();
    try {
      const type      = (args.component ?? 'skill') as PackageType;
      const provider  = (args.provider  ?? 'standard') as Provider;
      const scope     = (args.scope     ?? 'local') as Scope;

      const registry  = await this.assistant?.resolve<ApmRegistryService>('apm:registry');
      const installer = await this.assistant?.resolve<ApmInstallerService>('apm:installer');
      const lockSvc   = await this.assistant?.resolve<ApmLockService>('apm:lock');

      let names = args.packages ?? [];
      if (!names.length) {
        names = (registry?.getInstalled(type) ?? [])
          .filter(p => p.provider === provider && p.scope === scope)
          .map(p => p.name);
      }

      await this.log({
        flow, src: 'APM:ApmMCPController:uninstall',
        message: `Removing ${names.length} ${type}(s) from ${provider}/${scope}`,
        category: VCategory.mcp.tool,
      });

      const result = installer!.uninstall(names, type, provider, scope, args.dir);

      if (result.succeeded.length) {
        lockSvc?.removeEntries(result.succeeded, provider, scope);
      }

      return this._text(JSON.stringify({
        succeeded: result.succeeded,
        skipped:   result.skipped,
        errors:    result.errors,
      }, null, 2));

    } catch (err) {
      return this._error(err);
    }
  }

  private async _list(args: {
    component?:   string;
    projectRoot?: string;
  }): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
      const type     = (args.component ?? 'skill') as PackageType;
      const registry = await this.assistant?.resolve<ApmRegistryService>('apm:registry');
      const packages = registry?.getAvailable(type) ?? [];
      return this._text(JSON.stringify(packages, null, 2));
    } catch (err) {
      return this._error(err);
    }
  }

  private async _status(args: {
    component?:   string;
    projectRoot?: string;
  }): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
      const type     = (args.component ?? 'skill') as PackageType;
      const registry = await this.assistant?.resolve<ApmRegistryService>('apm:registry');
      const installed = registry?.getInstalled(type) ?? [];
      return this._text(JSON.stringify(installed, null, 2));
    } catch (err) {
      return this._error(err);
    }
  }

  private async _outdated(args: {
    component?:   string;
    projectRoot?: string;
  }): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
      const type     = (args.component ?? 'skill') as PackageType;
      const registry = await this.assistant?.resolve<ApmRegistryService>('apm:registry');
      const installed = (registry?.getInstalled(type) ?? []).filter(p => p.isOutdated);
      return this._text(JSON.stringify(installed, null, 2));
    } catch (err) {
      return this._error(err);
    }
  }

  // ── private helpers ───────────────────────────────────────────────────────

  private _resolveRoot(): string {
    return findProjectRoot();
  }

  private _text(text: string): { content: Array<{ type: 'text'; text: string }> } {
    return { content: [{ type: 'text' as const, text }] };
  }

  private _error(err: unknown): { content: Array<{ type: 'text'; text: string }> } {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text' as const, text: `Error: ${msg}` }] };
  }
}
