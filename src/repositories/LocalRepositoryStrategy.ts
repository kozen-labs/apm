import fs from 'fs';
import path from 'path';
import { ApmPackage } from '../models/package.model';
import { ApmSource } from '../models/config.model';
import { PackageType, inferGroup } from '../models/provider.model';
import { parseFrontmatter } from '../utils/frontmatter';
import { IRepositoryStrategy } from './IRepositoryStrategy';

const DEFAULT_SKILLS_PATH = path.join('.agents', 'skills');
const DEFAULT_AGENTS_PATH = path.join('.agents', 'agents');

/**
 * LocalRepositoryStrategy — reads packages from a directory on disk.
 *
 * Source config:
 *   type: 'local'
 *   path: '.'                    (relative to projectRoot, default '.')
 *   skillsPath: '.agents/skills' (relative to source root, default shown)
 *   agentsPath: '.agents/agents' (relative to source root, default shown)
 *   namespace: 'myteam'          (optional name prefix)
 *   singleResource: true         (entire source root is one package)
 *   resourceName: 'my-skill'     (explicit name for singleResource)
 */
export class LocalRepositoryStrategy implements IRepositoryStrategy {
  readonly type = 'local';

  list(source: ApmSource, _cacheDir: string, projectRoot: string): ApmPackage[] {
    const sourceRoot = this.resolveRoot(source, projectRoot);
    if (source.singleResource) {
      return this.scanSingle(source, sourceRoot);
    }
    const skills = this.scanDir(
      path.join(sourceRoot, source.skillsPath ?? DEFAULT_SKILLS_PATH),
      PackageType.SKILL,
      source,
      sourceRoot,
      'ks-',
    );
    const agents = this.scanDir(
      path.join(sourceRoot, source.agentsPath ?? DEFAULT_AGENTS_PATH),
      PackageType.AGENT,
      source,
      sourceRoot,
      '',
    );
    return [...skills, ...agents];
  }

  getLocalPath(
    pkg: ApmPackage,
    source: ApmSource,
    _cacheDir: string,
    projectRoot: string,
  ): string {
    const sourceRoot = this.resolveRoot(source, projectRoot);
    if (source.singleResource) return sourceRoot;
    // pkg.path is relative to the skills/agents base dir
    if (pkg.type === PackageType.AGENT) {
      return path.join(sourceRoot, source.agentsPath ?? DEFAULT_AGENTS_PATH, pkg.name + '.md');
    }
    return path.join(sourceRoot, source.skillsPath ?? DEFAULT_SKILLS_PATH, pkg.name);
  }

  refresh(): void { /* no-op: local source is always current */ }
  isStale(): boolean { return false; }

  // ── private ──────────────────────────────────────────────────────────────

  private resolveRoot(source: ApmSource, projectRoot: string): string {
    return path.resolve(projectRoot, source.path ?? '.');
  }

  private scanDir(
    dir: string,
    type: PackageType,
    source: ApmSource,
    sourceRoot: string,
    prefix: string,
  ): ApmPackage[] {
    if (!fs.existsSync(dir)) return [];
    const pkgs: ApmPackage[] = [];

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (type === PackageType.SKILL) {
        if (!entry.isDirectory()) continue;
        if (prefix && !entry.name.startsWith(prefix)) continue;
        const skillMd = path.join(dir, entry.name, 'SKILL.md');
        if (!fs.existsSync(skillMd)) continue;
        const fm = parseFrontmatter(skillMd);
        const name = this.withNs(source.namespace, entry.name);
        pkgs.push({
          name,
          path:        entry.name,
          type,
          description: String(fm.description ?? ''),
          group:       inferGroup(entry.name),
          created:     String(fm.created  ?? ''),
          updated:     String(fm.updated  ?? ''),
          version:     String(fm.version  ?? '1.0.0'),
          sourceRef:   source.name,
          localPath:   path.join(dir, entry.name),
        });
      } else {
        if (!entry.name.endsWith('.md')) continue;
        const agentFile = path.join(dir, entry.name);
        const fm = parseFrontmatter(agentFile);
        const baseName = entry.name.replace(/\.md$/, '');
        const name = this.withNs(source.namespace, baseName);
        pkgs.push({
          name,
          path:        entry.name,
          type,
          description: String(fm.description ?? '').slice(0, 200),
          group:       inferGroup(baseName),
          created:     String(fm.created ?? ''),
          updated:     String(fm.updated ?? ''),
          sourceRef:   source.name,
          localPath:   agentFile,
        });
      }
    }
    return pkgs.sort((a, b) => a.name.localeCompare(b.name));
  }

  private scanSingle(source: ApmSource, sourceRoot: string): ApmPackage[] {
    const skillMd = path.join(sourceRoot, 'SKILL.md');
    const name    = this.withNs(source.namespace, source.resourceName ?? source.name);
    const fm      = fs.existsSync(skillMd) ? parseFrontmatter(skillMd) : {};
    return [{
      name,
      path:        '.',
      type:        PackageType.SKILL,
      description: String(fm.description ?? ''),
      group:       inferGroup(name),
      created:     String(fm.created  ?? ''),
      updated:     String(fm.updated  ?? ''),
      version:     String(fm.version  ?? '1.0.0'),
      sourceRef:   source.name,
      localPath:   sourceRoot,
    }];
  }

  private withNs(namespace: string | undefined, name: string): string {
    return namespace ? `${namespace}/${name}` : name;
  }
}
