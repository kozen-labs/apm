import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { ApmPackage } from '../../models/package.model';
import { ApmSource } from '../../models/config.model';
import { PackageType, inferGroup } from '../../models/provider.model';
import { IRepositoryStrategy } from './IRepositoryStrategy';
import { GitHubRepositoryStrategy } from './GitHubRepositoryStrategy';

const CATALOG_STALE_MS = 6 * 60 * 60 * 1000; // 6 h

/**
 * Expected shape of each entry returned by the awesomeclaude.ai catalog API.
 * Fields not present in the API response are treated as empty strings.
 */
interface CatalogEntry {
  name:        string;
  description: string;
  /** GitHub clone URL of the skill's source repository. */
  url:         string;
  type?:       'skill' | 'agent';
  namespace?:  string;
  skillsPath?: string;
  agentsPath?: string;
  updated?:    string;
}

/**
 * AwesomeClaudeRegistryStrategy — fetches the awesomeclaude.ai skill catalog
 * and presents each listed skill as an installable APM package.
 *
 * How it works:
 *   1. list()        → downloads the JSON catalog (or reads from local cache)
 *                      and returns one ApmPackage per catalog entry.
 *   2. getLocalPath() → each entry carries its GitHub URL in pkg.localPath;
 *                      the strategy clones that repo on demand and returns
 *                      the local path of the skill directory.
 *   3. refresh()     → re-fetches the catalog from the remote URL.
 *
 * Catalog URL (configurable via source.url):
 *   Default: https://awesomeclaude.ai/api/skills.json
 *
 * Source config example:
 *   { "type": "awesome-claude", "name": "awesome-claude",
 *     "url": "https://awesomeclaude.ai/api/skills.json", "enabled": false }
 */
export class AwesomeClaudeRegistryStrategy implements IRepositoryStrategy {
  readonly type = 'awesome-claude';

  private github = new GitHubRepositoryStrategy();

  list(source: ApmSource, cacheDir: string, _projectRoot: string): ApmPackage[] {
    const catalog = this.loadCatalog(source, cacheDir);
    return catalog.map(entry => this.toPackage(entry, source));
  }

  /**
   * Clones the skill's source repository and returns the local path.
   * pkg.localPath carries the GitHub URL set during list(); this method
   * delegates the actual clone to GitHubRepositoryStrategy.
   */
  getLocalPath(pkg: ApmPackage, source: ApmSource, cacheDir: string, _projectRoot: string): string {
    if (!pkg.localPath) {
      throw new Error(`awesome-claude package "${pkg.name}" has no source URL in localPath.`);
    }
    // Build a synthetic ApmSource so GitHubRepositoryStrategy can clone the repo.
    const ghSource: ApmSource = {
      name:       `awesome-claude_${pkg.name}`,
      type:       'github',
      url:        pkg.localPath,
      skillsPath: (pkg as ApmPackage & { _skillsPath?: string })._skillsPath,
      agentsPath: (pkg as ApmPackage & { _agentsPath?: string })._agentsPath,
    };
    return this.github.getLocalPath(pkg, ghSource, cacheDir, '');
  }

  refresh(source: ApmSource, cacheDir: string): void {
    this.loadCatalog(source, cacheDir, true);
  }

  isStale(source: ApmSource, cacheDir: string): boolean {
    const cachePath = this.catalogCachePath(source, cacheDir);
    if (!fs.existsSync(cachePath)) return true;
    return Date.now() - fs.statSync(cachePath).mtimeMs > CATALOG_STALE_MS;
  }

  // ── private ─────────────────────────────────────────────────────────────────

  private loadCatalog(source: ApmSource, cacheDir: string, force = false): CatalogEntry[] {
    const cachePath = this.catalogCachePath(source, cacheDir);

    if (!force && fs.existsSync(cachePath)) {
      try {
        return JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CatalogEntry[];
      } catch { /* fall through to re-fetch */ }
    }

    const url = source.url ?? 'https://awesomeclaude.ai/api/skills.json';
    const fetched = this.fetchJson(url);

    if (!fetched) return [];

    // Normalise: the API may return an array directly or { skills: [...] }
    const entries: CatalogEntry[] = Array.isArray(fetched)
      ? (fetched as CatalogEntry[])
      : ((fetched as { skills?: CatalogEntry[] }).skills ?? []);

    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(entries, null, 2), 'utf-8');
    return entries;
  }

  private fetchJson(url: string): unknown {
    try {
      // Inline Node.js https fetch — avoids external dependencies.
      const raw = execSync(
        `node -e "var h=require('https'),d='';` +
        `h.get('${url}',function(r){r.on('data',function(c){d+=c});` +
        `r.on('end',function(){process.stdout.write(d)})}).on('error',function(){process.exit(1)});"`,
        { timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] },
      ).toString('utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private toPackage(entry: CatalogEntry, source: ApmSource): ApmPackage {
    const rawName = entry.namespace ? `${entry.namespace}/${entry.name}` : entry.name;
    const name    = source.namespace ? `${source.namespace}/${rawName}` : rawName;
    // Store the GitHub URL in localPath so getLocalPath() can clone it.
    // skillsPath and agentsPath are piggybacked as non-standard fields for getLocalPath().
    const pkg: ApmPackage & { _skillsPath?: string; _agentsPath?: string } = {
      name,
      path:        entry.name,
      type:        (entry.type ?? 'skill') as PackageType,
      description: entry.description ?? '',
      group:       inferGroup(entry.name),
      created:     '',
      updated:     entry.updated ?? '',
      sourceRef:   source.name,
      localPath:   entry.url,  // GitHub URL — resolved to disk path in getLocalPath()
    };
    if (entry.skillsPath) pkg._skillsPath = entry.skillsPath;
    if (entry.agentsPath) pkg._agentsPath = entry.agentsPath;
    return pkg;
  }

  private catalogCachePath(source: ApmSource, cacheDir: string): string {
    const base = cacheDir || path.join(os.homedir(), '.apm', 'cache');
    return path.join(base, `${source.name}-catalog.json`);
  }
}
