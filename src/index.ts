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
export { type IRepositoryStrategy } from './repositories/IRepositoryStrategy';
export { type IProviderStrategy }   from './providers/IProviderStrategy';
export { LocalRepositoryStrategy }  from './repositories/LocalRepositoryStrategy';
export { GitHubRepositoryStrategy } from './repositories/GitHubRepositoryStrategy';
export { StandardProviderStrategy } from './providers/StandardProviderStrategy';
export { ClaudeProviderStrategy }   from './providers/ClaudeProviderStrategy';
export { VscodeProviderStrategy }   from './providers/VscodeProviderStrategy';
export {
  resolveInstallPath,
  allSkillLocations,
  allAgentLocations,
  skillSourceBases,
  agentSourceBases,
} from './providers/path.resolver';
export { parseFrontmatter, stripFrontmatter } from './utils/frontmatter';
export { findProjectRoot, getOs }             from './platform/system';
export * from './models/package.model';
export * from './models/provider.model';
export * from './models/config.model';
