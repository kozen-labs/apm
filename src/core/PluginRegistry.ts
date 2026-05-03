import { IRepositoryStrategy } from '../plugins/repositories/IRepositoryStrategy';
import { IProviderStrategy }   from '../plugins/providers/IProviderStrategy';
import { IComponentPlugin }    from '../plugins/components/IComponentPlugin';
import { PackageType }         from '../models/provider.model';

/**
 * PluginRegistry — the APM microkernel.
 *
 * Holds three runtime extension maps:
 *   - repositories: source-fetching strategies (local, github, npm)
 *   - providers:    install-target strategies (standard, claude, cursor, …)
 *   - components:   component-type plugins (skill, agent, hook, context)
 *
 * Core logic depends only on this module; concrete strategy classes are
 * wired in bootstrap.ts. Adding a new source, target, or component type
 * requires registering one new plugin — no other code changes.
 */

const repositories = new Map<string, IRepositoryStrategy>();
const providers    = new Map<string, IProviderStrategy>();
const components   = new Map<PackageType, IComponentPlugin>();

// ── Repository ────────────────────────────────────────────────────────────────

export function registerRepository(strategy: IRepositoryStrategy): void {
  repositories.set(strategy.type, strategy);
}

export function getRepository(type: string): IRepositoryStrategy {
  const s = repositories.get(type);
  if (!s) throw new Error(`No repository strategy registered for type "${type}". Call registerRepository() first.`);
  return s;
}

export function listRepositoryTypes(): string[]          { return [...repositories.keys()]; }
export function hasRepository(type: string): boolean     { return repositories.has(type); }

// ── Provider ──────────────────────────────────────────────────────────────────

export function registerProvider(strategy: IProviderStrategy): void {
  providers.set(strategy.name, strategy);
}

export function getProvider(name: string): IProviderStrategy {
  const s = providers.get(name);
  if (!s) throw new Error(`No provider strategy registered for "${name}". Call registerProvider() first.`);
  return s;
}

export function listProviderNames(): string[]          { return [...providers.keys()]; }
export function hasProvider(name: string): boolean     { return providers.has(name); }

// ── Component ─────────────────────────────────────────────────────────────────

export function registerComponent(plugin: IComponentPlugin): void {
  components.set(plugin.type, plugin);
}

export function getComponent(type: PackageType): IComponentPlugin {
  const p = components.get(type);
  if (!p) throw new Error(`No component plugin registered for type "${type}". Call registerComponent() first.`);
  return p;
}

export function listComponentTypes(): PackageType[]        { return [...components.keys()]; }
export function hasComponent(type: PackageType): boolean   { return components.has(type); }
