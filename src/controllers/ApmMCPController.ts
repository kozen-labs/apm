import { MCPController, VCategory } from '@kozen/engine';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { z } from 'zod';
import { PackageType } from '../models/PackageType';
import { Provider } from '../models/Provider';
import { Scope } from '../models/Scope';
import { findProjectRoot } from '../utils/system';
import type { IComponent } from '../models/IComponent';

/**
 * ApmMCPController — thin dispatcher over the component plugin system.
 *
 * Each MCP tool resolves the matching component plugin and calls its action.
 * Tool naming convention: kozen_apm_<action>
 */
export class ApmMCPController extends MCPController {

  private readonly componentSchema: ReturnType<typeof z.enum>;
  private readonly providerSchema:  ReturnType<typeof z.enum>;
  private readonly scopeSchema:     ReturnType<typeof z.enum>;
  private readonly projectRootSchema: z.ZodOptional<z.ZodString>;

  constructor(dependency?: any) {
    super(dependency);
    this.componentSchema = z
      .enum(['skill', 'agent']).default('skill')
      .describe('Component type to operate on') as unknown as ReturnType<typeof z.enum>;
    this.providerSchema = z
      .enum(['standard', 'claude', 'cursor', 'vscode', 'windsurf']).default('standard')
      .describe('AI tool provider to install into') as unknown as ReturnType<typeof z.enum>;
    this.scopeSchema = z
      .enum(['local', 'global']).default('local')
      .describe('Install scope: local (current project) or global (home directory)') as unknown as ReturnType<typeof z.enum>;
    this.projectRootSchema = z
      .string().optional()
      .describe('Absolute path to the project root. Auto-detected from CWD if omitted.');
  }

  // ── plugin resolution ─────────────────────────────────────────────────────

  private async plugin(type: string): Promise<IComponent> {
    return this.assistant!.resolve<IComponent>(`apm:plugin:component:${type}`);
  }

  // ── register tools ────────────────────────────────────────────────────────

  public async register(server: McpServer): Promise<void> {
    const { componentSchema, providerSchema, scopeSchema, projectRootSchema } = this;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore TS2589 — Zod+MCP generic inference exceeds TypeScript's depth limit; runtime is correct.
    server.registerTool('kozen_apm_install', {
      description:
        'Install AI skills or agents into an AI tool provider ' +
        '(Claude Code, Cursor, VSCode, Windsurf, or a standard .agents/ directory).',
      inputSchema: {
        packages:    z.array(z.string()).optional().describe('Package names to install. Omit to install all available.'),
        component:   componentSchema,
        provider:    providerSchema,
        scope:       scopeSchema,
        projectRoot: projectRootSchema,
        dir:         z.string().optional().describe('Custom install directory (overrides scope path)'),
      },
    }, this._install.bind(this));

    server.registerTool('kozen_apm_uninstall', {
      description: 'Remove installed AI skills or agents from a provider.',
      inputSchema: {
        packages:    z.array(z.string()).optional().describe('Package names to remove. Omit to remove all.'),
        component:   componentSchema,
        provider:    providerSchema,
        scope:       scopeSchema,
        projectRoot: projectRootSchema,
        dir:         z.string().optional().describe('Custom install directory'),
      },
    }, this._uninstall.bind(this));

    server.registerTool('kozen_apm_list', {
      description: 'List all available AI packages (skills or agents) from the configured sources.',
      inputSchema: {
        component:   componentSchema,
        projectRoot: projectRootSchema,
      },
    }, this._list.bind(this));

    server.registerTool('kozen_apm_status', {
      description: 'Show all installed AI packages across every provider and scope.',
      inputSchema: {
        component:   componentSchema,
        projectRoot: projectRootSchema,
      },
    }, this._status.bind(this));

    server.registerTool('kozen_apm_outdated', {
      description: 'Return only the installed packages that have a newer version available.',
      inputSchema: {
        component:   componentSchema,
        projectRoot: projectRootSchema,
      },
    }, this._outdated.bind(this));
  }

  // ── tool handlers ─────────────────────────────────────────────────────────

  private async _install(args: {
    packages?: string[]; component?: string; provider?: string;
    scope?: string; projectRoot?: string; dir?: string;
  }): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const flow = this.getId();
    try {
      const type     = (args.component ?? 'skill') as PackageType;
      const provider = (args.provider  ?? 'standard') as Provider;
      const scope    = (args.scope     ?? 'local') as Scope;
      const names    = args.packages ?? [];
      const root     = args.projectRoot ?? findProjectRoot();

      await this.log({
        flow, src: 'apm:ApmMCPController:install',
        message: `Installing ${names.length || 'all'} ${type}(s) via ${provider}/${scope}`,
        category: VCategory.mcp.tool,
      });

      const p      = await this.plugin(type);
      const result = await p.install({ projectRoot: root, provider, scope, names, customDir: args.dir });

      return this._text(JSON.stringify({
        succeeded: result.succeeded,
        skipped:   result.skipped,
        errors:    result.errors,
        target:    result.target,
        elapsed:   result.elapsed,
      }, null, 2));
    } catch (err) { return this._error(err); }
  }

  private async _uninstall(args: {
    packages?: string[]; component?: string; provider?: string;
    scope?: string; projectRoot?: string; dir?: string;
  }): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const flow = this.getId();
    try {
      const type     = (args.component ?? 'skill') as PackageType;
      const provider = (args.provider  ?? 'standard') as Provider;
      const scope    = (args.scope     ?? 'local') as Scope;
      const names    = args.packages ?? [];
      const root     = args.projectRoot ?? findProjectRoot();

      await this.log({
        flow, src: 'apm:ApmMCPController:uninstall',
        message: `Removing ${names.length || 'all'} ${type}(s) from ${provider}/${scope}`,
        category: VCategory.mcp.tool,
      });

      const p      = await this.plugin(type);
      const result = await p.uninstall({ projectRoot: root, provider, scope, names, customDir: args.dir });

      return this._text(JSON.stringify({
        succeeded: result.succeeded,
        skipped:   result.skipped,
        errors:    result.errors,
      }, null, 2));
    } catch (err) { return this._error(err); }
  }

  private async _list(args: {
    component?: string; projectRoot?: string;
  }): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
      const type     = (args.component ?? 'skill') as PackageType;
      const root     = args.projectRoot ?? findProjectRoot();
      const p        = await this.plugin(type);
      const packages = await p.list({ projectRoot: root });
      return this._text(JSON.stringify(packages, null, 2));
    } catch (err) { return this._error(err); }
  }

  private async _status(args: {
    component?: string; projectRoot?: string;
  }): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
      const type      = (args.component ?? 'skill') as PackageType;
      const root      = args.projectRoot ?? findProjectRoot();
      const p         = await this.plugin(type);
      const installed = await p.status({ projectRoot: root });
      return this._text(JSON.stringify(installed, null, 2));
    } catch (err) { return this._error(err); }
  }

  private async _outdated(args: {
    component?: string; projectRoot?: string;
  }): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
      const type  = (args.component ?? 'skill') as PackageType;
      const root  = args.projectRoot ?? findProjectRoot();
      const p     = await this.plugin(type);
      const stale = await p.outdated({ projectRoot: root });
      return this._text(JSON.stringify(stale, null, 2));
    } catch (err) { return this._error(err); }
  }

  // ── private helpers ───────────────────────────────────────────────────────

  private _text(text: string): { content: Array<{ type: 'text'; text: string }> } {
    return { content: [{ type: 'text' as const, text }] };
  }

  private _error(err: unknown): { content: Array<{ type: 'text'; text: string }> } {
    return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
  }
}
