import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { ApmPackage } from '../../models/package.model';
import { ApmSource } from '../../models/config.model';
import { PackageType, inferGroup } from '../../models/provider.model';
import { IComponentScanner } from '../../models/component.model';
import { IRepository } from './IRepository';
import { GitHubRepository } from './GitHubRepository';

const CATALOG_STALE_MS = 6 * 60 * 60 * 1000; // 6 h

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
  readonly type = 'awesome-claude';

  private github = new GitHubRepository();

  list(source: ApmSource, cacheDir: string, _projectRoot: string, _component?: IComponentScanner): ApmPackage[] {
    const catalog = this.loadCatalog(source, cacheDir);
    return catalog.map(entry => this.toPackage(entry, source));
  }

  getLocalPath(pkg: ApmPackage, source: ApmSource, cacheDir: string, _projectRoot: string): string {
    if (!pkg.localPath) {
      throw new Error(`awesome-claude package "${pkg.name}" has no source URL in localPath.`);
    }
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

    const url     = source.url ?? 'https://awesomeclaude.ai/api/skills.json';
    const fetched = this.fetchJson(url);

    if (!fetched) return [];

    const entries: CatalogEntry[] = Array.isArray(fetched)
      ? (fetched as CatalogEntry[])
      : ((fetched as { skills?: CatalogEntry[] }).skills ?? []);

    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(entries, null, 2), 'utf-8');
    return entries;
  }

  private fetchJson(url: string): unknown {
    try {
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
    const pkg: ApmPackage & { _skillsPath?: string; _agentsPath?: string } = {
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

  private catalogCachePath(source: ApmSource, cacheDir: string): string {
    const base = cacheDir || path.join(os.homedir(), '.apm', 'cache');
    return path.join(base, `${source.name}-catalog.json`);
  }
}
