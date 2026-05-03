/**
 * APM — Agent Package Manager
 * Public API barrel — re-exports every stable interface.
 */

export { ApmRegistry }         from './core/registry';
export { ApmInstaller }        from './core/installer';
export { ApmManifestManager }  from './core/manifest';
export { ApmConfigManager }    from './core/config';
export { ApmLockManager }      from './core/lock';
export { bootstrap }           from './core/bootstrap';
export * as PluginRegistry     from './core/PluginRegistry';

// ── Plugin interfaces ──────────────────────────────────────────────────────────
export { type IRepositoryStrategy } from './plugins/repositories/IRepositoryStrategy';
export { type IProviderStrategy }   from './plugins/providers/IProviderStrategy';
export { type IComponentPlugin }    from './plugins/components/IComponentPlugin';

// ── Repository strategies ──────────────────────────────────────────────────────
export { LocalRepositoryStrategy }  from './plugins/repositories/local';
export { GitHubRepositoryStrategy } from './plugins/repositories/github';
export { NpmRepositoryStrategy }    from './plugins/repositories/npm';

// ── Provider strategies ────────────────────────────────────────────────────────
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

// ── Component plugins ──────────────────────────────────────────────────────────
export { SkillPlugin }   from './plugins/components/skill';
export { AgentPlugin }   from './plugins/components/agent';
export { HookPlugin }    from './plugins/components/hook';
export { ContextPlugin } from './plugins/components/context';

// ── Utilities and models ───────────────────────────────────────────────────────
export { parseFrontmatter, stripFrontmatter } from './utils/frontmatter';
export { findProjectRoot, getOs }             from './platform/system';
export * from './models/package.model';
export * from './models/provider.model';
export * from './models/config.model';
