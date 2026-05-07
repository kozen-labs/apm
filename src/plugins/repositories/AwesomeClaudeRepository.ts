import { access, readFile, writeFile, mkdir, stat } from 'fs/promises';
import path from 'path';
import os from 'os';
import { IApmPackage } from '../../models/IApmPackage';
import { IApmSource } from '../../models/IApmSource';
import { PackageType } from '../../models/PackageType';
import { inferGroup } from '../../models/Groups';
import { IComponentScanner } from '../../models/IComponentScanner';
import { IRepository } from '../../models/IRepository';
import { GitHubRepository } from './GitHubRepository';

const CATALOG_STALE_MS = 6 * 60 * 60 * 1000;

interface CatalogEntry {
  name:        string;
  description: string;
  url:         string;
  type?:       'skill' | 'agent';
  namespace?:  string;
  skillsPath?: string;
  agentsPath?: string;
  updated?:    string;
}

export class AwesomeClaudeRepository implements IRepository {
  readonly type: string;
  private readonly githubRepo: GitHubRepository;

  constructor(dependency?: { githubRepo?: GitHubRepository }) {
    this.type       = 'awesome-claude';
    this.githubRepo = dependency?.githubRepo ?? new GitHubRepository();
  }

  async list(source: IApmSource, cacheDir: string, _projectRoot: string, _component?: IComponentScanner): Promise<IApmPackage[]> {
    const catalog = await this.loadCatalog(source, cacheDir);
    return catalog.map(entry => this.toPackage(entry, source));
  }

  async getLocalPath(pkg: IApmPackage, _source: IApmSource, cacheDir: string, _projectRoot: string): Promise<string> {
    if (!pkg.localPath) {
      throw new Error(`awesome-claude package "${pkg.name}" has no source URL in localPath.`);
    }
    const ghSource: IApmSource = {
      name:       `awesome-claude_${pkg.name}`,
      type:       'github',
      url:        pkg.localPath,
      skillsPath: (pkg as IApmPackage & { _skillsPath?: string })._skillsPath,
      agentsPath: (pkg as IApmPackage & { _agentsPath?: string })._agentsPath,
    };
    return this.githubRepo.getLocalPath(pkg, ghSource, cacheDir, '');
  }

  async refresh(source: IApmSource, cacheDir: string): Promise<void> {
    await this.loadCatalog(source, cacheDir, true);
  }

  async isStale(source: IApmSource, cacheDir: string): Promise<boolean> {
    const cachePath = this.catalogCachePath(source, cacheDir);
    try {
      const s = await stat(cachePath);
      return Date.now() - s.mtimeMs > CATALOG_STALE_MS;
    } catch {
      return true;
    }
  }

  // ── private ─────────────────────────────────────────────────────────────────

  private async loadCatalog(source: IApmSource, cacheDir: string, force = false): Promise<CatalogEntry[]> {
    const cachePath = this.catalogCachePath(source, cacheDir);

    if (!force && await this.exists(cachePath)) {
      try {
        const text = await readFile(cachePath, 'utf-8');
        return JSON.parse(text) as CatalogEntry[];
      } catch { /* fall through to re-fetch */ }
    }

    const url     = source.url ?? 'https://awesomeclaude.ai/api/skills.json';
    const fetched = await this.fetchJson(url);

    if (!fetched) return [];

    const entries: CatalogEntry[] = Array.isArray(fetched)
      ? (fetched as CatalogEntry[])
      : ((fetched as { skills?: CatalogEntry[] }).skills ?? []);

    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, JSON.stringify(entries, null, 2), 'utf-8');
    return entries;
  }

  private async fetchJson(url: string): Promise<unknown> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  private toPackage(entry: CatalogEntry, source: IApmSource): IApmPackage {
    const rawName = entry.namespace ? `${entry.namespace}/${entry.name}` : entry.name;
    const name    = source.namespace ? `${source.namespace}/${rawName}` : rawName;
    const pkg: IApmPackage & { _skillsPath?: string; _agentsPath?: string } = {
      name,
      path:        entry.name,
      type:        (entry.type ?? 'skill') as PackageType,
      description: entry.description ?? '',
      group:       inferGroup(entry.name),
      created:     '',
      updated:     entry.updated ?? '',
      sourceRef:   source.name,
      localPath:   entry.url,
    };
    if (entry.skillsPath) pkg._skillsPath = entry.skillsPath;
    if (entry.agentsPath) pkg._agentsPath = entry.agentsPath;
    return pkg;
  }

  private catalogCachePath(source: IApmSource, cacheDir: string): string {
    const base = cacheDir || path.join(os.homedir(), '.apm', 'cache');
    return path.join(base, `${source.name}-catalog.json`);
  }

  private async exists(p: string): Promise<boolean> {
    try { await access(p); return true; } catch { return false; }
  }
}
