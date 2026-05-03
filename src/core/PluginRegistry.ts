import { IRepositoryStrategy } from '../repositories/IRepositoryStrategy';
import { IProviderStrategy }   from '../providers/IProviderStrategy';

/**
 * PluginRegistry — the APM microkernel.
 *
 * Holds the runtime maps of repository and provider strategy plugins.
 * Core logic (ApmRegistry, ApmInstaller) depends only on this interface,
 * never on concrete strategy classes. Adding a new source type or provider
 * requires registering one new plugin; no other code changes.
 *
 * Usage:
 *   // Registration (done once in bootstrap.ts)
 *   registerRepository(new GitHubRepositoryStrategy());
 *   registerProvider(new ClaudeProviderStrategy());
 *
 *   // Lookup (in core/registry.ts, core/installer.ts)
 *   const strategy = getRepository('github');
 *   const provider = getProvider('claude');
 */

const repositories = new Map<string, IRepositoryStrategy>();
const providers    = new Map<string, IProviderStrategy>();

export function registerRepository(strategy: IRepositoryStrategy): void {
  repositories.set(strategy.type, strategy);
}

export function registerProvider(strategy: IProviderStrategy): void {
  providers.set(strategy.name, strategy);
}

export function getRepository(type: string): IRepositoryStrategy {
  const s = repositories.get(type);
  if (!s) throw new Error(`No repository strategy registered for type "${type}". Call registerRepository() first.`);
  return s;
}

export function getProvider(name: string): IProviderStrategy {
  const s = providers.get(name);
  if (!s) throw new Error(`No provider strategy registered for "${name}". Call registerProvider() first.`);
  return s;
}

export function listRepositoryTypes(): string[]  { return [...repositories.keys()]; }
export function listProviderNames(): string[]    { return [...providers.keys()]; }
export function hasRepository(type: string): boolean { return repositories.has(type); }
export function hasProvider(name: string): boolean   { return providers.has(name); }
