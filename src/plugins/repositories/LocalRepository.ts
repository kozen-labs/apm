import { access, readdir } from 'fs/promises';
import path from 'path';
import { IApmPackage } from '../../models/IApmPackage';
import { IApmSource } from '../../models/IApmSource';
import { PackageType } from '../../models/PackageType';
import { inferGroup } from '../../models/Groups';
import { IComponentScanner } from '../../models/IComponentScanner';
import { IRepository } from '../../models/IRepository';

const DEFAULT_SKILLS_PATH = path.join('.agents', 'skills');
const DEFAULT_AGENTS_PATH = path.join('.agents', 'agents');

export class LocalRepository implements IRepository {
  readonly type: string;

  constructor() {
    this.type = 'local';
  }

  async list(source: IApmSource, _cacheDir: string, projectRoot: string, component: IComponentScanner): Promise<IApmPackage[]> {
    const sourceRoot = this.resolveRoot(source, projectRoot);
    if (source.singleResource) {
      return this.scanSingle(source, sourceRoot, component);
    }
    const [skills, agents] = await Promise.all([
      this.scanDir(
        path.join(sourceRoot, source.skillsPath ?? DEFAULT_SKILLS_PATH),
        PackageType.SKILL,
        source,
        component,
      ),
      this.scanDir(
        path.join(sourceRoot, source.agentsPath ?? DEFAULT_AGENTS_PATH),
        PackageType.AGENT,
        source,
        component,
      ),
    ]);
    return [...skills, ...agents];
  }

  async getLocalPath(pkg: IApmPackage, source: IApmSource, _cacheDir: string, projectRoot: string): Promise<string> {
    const sourceRoot = this.resolveRoot(source, projectRoot);
    if (source.singleResource) return sourceRoot;
    if (pkg.type === PackageType.AGENT) {
      return path.join(sourceRoot, source.agentsPath ?? DEFAULT_AGENTS_PATH, pkg.name + '.md');
    }
    return path.join(sourceRoot, source.skillsPath ?? DEFAULT_SKILLS_PATH, pkg.name);
  }

  async refresh(): Promise<void> { /* no-op: local source is always current */ }
  async isStale(): Promise<boolean> { return false; }

  // ── private ──────────────────────────────────────────────────────────────

  private resolveRoot(source: IApmSource, projectRoot: string): string {
    return path.resolve(projectRoot, source.path ?? '.');
  }

  private async scanDir(dir: string, type: PackageType, source: IApmSource, component: IComponentScanner): Promise<IApmPackage[]> {
    if (component.type !== type) return [];
    try {
      await access(dir);
    } catch {
      return [];
    }

    const entries = await readdir(dir, { withFileTypes: true });
    const results = await Promise.all(
      entries.map(async entry => {
        if (!(await component.matchEntry(entry, dir))) return null;
        const entryPath = path.join(dir, entry.name);
        const meta      = await component.readMeta(entryPath, entry.name);
        const baseName  = (meta as { _baseName?: string })._baseName ?? entry.name;
        return {
          name:        this.withNs(source.namespace, baseName),
          path:        entry.name,
          type,
          description: String(meta.description ?? ''),
          group:       inferGroup(baseName),
          created:     String(meta.created  ?? ''),
          updated:     String(meta.updated  ?? ''),
          version:     String(meta.version  ?? ''),
          sourceRef:   source.name,
          localPath:   entryPath,
        } satisfies IApmPackage;
      }),
    );

    return (results.filter(Boolean) as IApmPackage[]).sort((a, b) => a.name.localeCompare(b.name));
  }

  private async scanSingle(source: IApmSource, sourceRoot: string, component: IComponentScanner): Promise<IApmPackage[]> {
    if (component.type !== PackageType.SKILL) return [];
    const name = this.withNs(source.namespace, source.resourceName ?? source.name);
    const meta = await component.readMeta(sourceRoot, source.resourceName ?? source.name);
    return [{
      name,
      path:        '.',
      type:        PackageType.SKILL,
      description: String(meta.description ?? ''),
      group:       inferGroup(name),
      created:     String(meta.created  ?? ''),
      updated:     String(meta.updated  ?? ''),
      version:     String(meta.version  ?? '1.0.0'),
      sourceRef:   source.name,
      localPath:   sourceRoot,
    }];
  }

  private withNs(namespace: string | undefined, name: string): string {
    return namespace ? `${namespace}/${name}` : name;
  }
}
