import { IRepository }     from './repositories/IRepository';
import { IProvider }       from './providers/IProvider';
import { IComponentPlugin } from './components/IComponentPlugin';
import { PackageType }     from '../models/provider.model';

const repositories = new Map<string, IRepository>();
const providers    = new Map<string, IProvider>();
const components   = new Map<PackageType, IComponentPlugin>();

// ── Repository ────────────────────────────────────────────────────────────────

export function registerRepository(repo: IRepository): void {
  repositories.set(repo.type, repo);
}

export function getRepository(type: string): IRepository {
  const r = repositories.get(type);
  if (!r) throw new Error(`No repository registered for type "${type}". Call registerRepository() first.`);
  return r;
}

export function listRepositoryTypes(): string[]      { return [...repositories.keys()]; }
export function hasRepository(type: string): boolean { return repositories.has(type); }

// ── Provider ──────────────────────────────────────────────────────────────────

export function registerProvider(provider: IProvider): void {
  providers.set(provider.name, provider);
}

export function getProvider(name: string): IProvider {
  const p = providers.get(name);
  if (!p) throw new Error(`No provider registered for "${name}". Call registerProvider() first.`);
  return p;
}

export function listProviderNames(): string[]      { return [...providers.keys()]; }
export function hasProvider(name: string): boolean { return providers.has(name); }

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
