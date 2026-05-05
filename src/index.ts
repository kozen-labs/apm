import fs                               from 'fs';
import path                            from 'path';
import { KzModule, IConfig, IDependency } from '@kozen/engine';
import { bootstrap }      from './plugins/bootstrap';
import { findProjectRoot } from './utils/system';
import iocJson             from './configs/ioc.json';
import cliJson             from './configs/cli.json';
import mcpJson             from './configs/mcp.json';

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

  public async register(
    config: IConfig | null,
    opts?:  unknown,
  ): Promise<Record<string, IDependency> | null> {

    bootstrap();

    const projectRoot: string =
      (opts  as Record<string, unknown>)?.projectRoot as string ??
      (config as Record<string, unknown>)?.projectRoot as string ??
      findProjectRoot();

    const dynamic: Record<string, unknown> = {
      'apm:project-root': {
        key:    'apm:project-root',
        target: 'apm:project-root',
        type:   'value',
        value:  projectRoot,
      },
    };

    let dep: Record<string, unknown> = { ...iocJson, ...dynamic };
    if (config?.type === 'cli') dep = { ...dep, ...cliJson };
    if (config?.type === 'mcp') dep = { ...dep, ...mcpJson };

    return this.fix(dep as Record<string, IDependency>) as Record<string, IDependency>;
  }
}

export default ApmModule;

// ── Public library API ─────────────────────────────────────────────────────

export { ApmManifestManager } from './utils/manifest';
export { ApmConfigManager }   from './utils/config';
export { ApmLockManager }     from './utils/lock';
export { bootstrap }          from './plugins/bootstrap';
export * as PluginRegistry    from './plugins/PluginRegistry';

// ── Plugin interfaces ──────────────────────────────────────────────────────
export { type IRepository }     from './plugins/repositories/IRepository';
export { type IProvider }       from './plugins/providers/IProvider';
export { type IComponentPlugin } from './plugins/components/IComponentPlugin';

// ── Repositories ───────────────────────────────────────────────────────────
export { LocalRepository }         from './plugins/repositories/LocalRepository';
export { GitHubRepository }        from './plugins/repositories/GitHubRepository';
export { NpmRepository }           from './plugins/repositories/NpmRepository';
export { SkillsShRepository }      from './plugins/repositories/SkillsShRepository';
export { AwesomeClaudeRepository } from './plugins/repositories/AwesomeClaudeRepository';

// ── Providers ──────────────────────────────────────────────────────────────
export { StandardProvider } from './plugins/providers/StandardProvider';
export { ClaudeProvider }   from './plugins/providers/ClaudeProvider';
export { CursorProvider }   from './plugins/providers/CursorProvider';
export { VscodeProvider }   from './plugins/providers/VscodeProvider';
export { WindsurfProvider }  from './plugins/providers/WindsurfProvider';
export {
  resolveInstallPath,
  allSkillLocations,
  allAgentLocations,
  skillSourceBases,
  agentSourceBases,
} from './plugins/providers/path.resolver';

// ── Component plugins ──────────────────────────────────────────────────────
export { BaseComponentPlugin } from './plugins/components/BaseComponentPlugin';
export { SkillPlugin }         from './plugins/components/SkillPlugin';
export { AgentPlugin }         from './plugins/components/AgentPlugin';
export { HookPlugin }          from './plugins/components/HookPlugin';
export { ContextPlugin }       from './plugins/components/ContextPlugin';

// ── Utilities and models ───────────────────────────────────────────────────
export { parseFrontmatter, stripFrontmatter } from './utils/frontmatter';
export { findProjectRoot, getOs }             from './utils/system';
export * from './models/package.model';
export * from './models/provider.model';
export * from './models/config.model';
