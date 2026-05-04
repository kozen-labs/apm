import fs                               from 'fs';
import path                            from 'path';
import { KzModule, IConfig, IDependency } from '@kozen/engine';
import { bootstrap }      from './core/bootstrap';
import { findProjectRoot } from './utils/system';
import iocJson             from './configs/ioc.json';
import cliJson             from './configs/cli.json';
import mcpJson             from './configs/mcp.json';

/**
 * ApmModule — Kozen module entry point for @kozen/apm.
 *
 * Load via:
 *   npx kozen --moduleLoad=@kozen/apm --action=apm:<action>
 *   npx kozen --moduleLoad=@kozen/apm --type=mcp
 */
export class ApmModule extends KzModule {

  constructor(dependency?: any) {
    super(dependency);
    this.metadata.alias = 'apm';
    try {
      const pkgPath = path.resolve(__dirname, '../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
        name: string; version: string; description: string;
        author: string; license: string; homepage: string;
      };
      this.metadata.name        = pkg.name;
      this.metadata.version     = pkg.version;
      this.metadata.description = pkg.description;
      this.metadata.author      = pkg.author;
      this.metadata.license     = pkg.license;
      this.metadata.uri         = pkg.homepage;
    } catch { /* ignore — metadata is optional */ }
  }

  /**
   * Register IoC dependencies for the current runtime type (cli | mcp | sdk).
   *
   * KZN-005 workaround: projectRoot is auto-detected here instead of reading CLI
   * args (which are not passed to register()). When KZN-005 is resolved, replace
   * findProjectRoot() with: (opts as any)?.projectRoot ?? findProjectRoot()
   */
  public async register(
    config: IConfig | null,
    opts?:  unknown,
  ): Promise<Record<string, IDependency> | null> {

    // 1. Populate PluginRegistry Maps (idempotent)
    bootstrap();

    // 2. Resolve project root — CLI arg override > opts > config > auto-detect
    const projectRoot: string =
      (opts  as Record<string, unknown>)?.projectRoot as string ??
      (config as Record<string, unknown>)?.projectRoot as string ??
      findProjectRoot();

    // 3. Register projectRoot as a runtime-computed IoC value (KZN-002 pattern)
    const dynamic: Record<string, unknown> = {
      'apm:project-root': {
        key:    'apm:project-root',
        target: 'apm:project-root',
        type:   'value',
        value:  projectRoot,
      },
    };

    // 4. Merge base + dynamic + runtime-specific deps
    let dep: Record<string, unknown> = { ...iocJson, ...dynamic };
    if (config?.type === 'cli') dep = { ...dep, ...cliJson };
    if (config?.type === 'mcp') dep = { ...dep, ...mcpJson };

    return this.fix(dep as Record<string, IDependency>) as Record<string, IDependency>;
  }
}

export default ApmModule;

// ── Public library API (barrel re-exports) ─────────────────────────────────

export { ApmRegistry }         from './core/registry';
export { ApmInstaller }        from './core/installer';
export { ApmManifestManager }  from './core/manifest-manager';
export { ApmConfigManager }    from './core/config';
export { ApmLockManager }      from './core/lock';
export { bootstrap }           from './core/bootstrap';
export * as PluginRegistry     from './core/PluginRegistry';

// ── Plugin interfaces ──────────────────────────────────────────────────────
export { type IRepositoryStrategy } from './plugins/repositories/IRepositoryStrategy';
export { type IProviderStrategy }   from './plugins/providers/IProviderStrategy';
export { type IComponentPlugin }    from './plugins/components/IComponentPlugin';

// ── Repository strategies ──────────────────────────────────────────────────
export { LocalRepositoryStrategy }       from './plugins/repositories/local';
export { GitHubRepositoryStrategy }      from './plugins/repositories/github';
export { NpmRepositoryStrategy }         from './plugins/repositories/npm';
export { SkillsShRepositoryStrategy }    from './plugins/repositories/skillssh';
export { AwesomeClaudeRegistryStrategy } from './plugins/repositories/awesomeclaude';

// ── Provider strategies ────────────────────────────────────────────────────
export { StandardProviderStrategy } from './plugins/providers/standard';
export { ClaudeProviderStrategy }   from './plugins/providers/claude';
export { CursorProviderStrategy }   from './plugins/providers/cursor';
export { VscodeProviderStrategy }   from './plugins/providers/vscode';
export { WindsurfProviderStrategy } from './plugins/providers/windsurf';
export {
  resolveInstallPath,
  allSkillLocations,
  allAgentLocations,
  skillSourceBases,
  agentSourceBases,
} from './plugins/providers/path.resolver';

// ── Component plugins ──────────────────────────────────────────────────────
export { SkillPlugin }   from './plugins/components/SkillPlugin';
export { AgentPlugin }   from './plugins/components/AgentPlugin';
export { HookPlugin }    from './plugins/components/HookPlugin';
export { ContextPlugin } from './plugins/components/ContextPlugin';

// ── Utilities and models ───────────────────────────────────────────────────
export { parseFrontmatter, stripFrontmatter } from './utils/frontmatter';
export { findProjectRoot, getOs }             from './utils/system';
export * from './models/package.model';
export * from './models/provider.model';
export * from './models/config.model';
