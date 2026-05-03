import fs from 'fs';
import path from 'path';
import { ApmPackage } from '../../models/package.model';
import { ApmSource } from '../../models/config.model';
import { PackageType, inferGroup } from '../../models/provider.model';
import { IRepositoryStrategy } from './IRepositoryStrategy';
import { getComponent, hasComponent } from '../../core/PluginRegistry';

const DEFAULT_SKILLS_PATH = path.join('.agents', 'skills');
const DEFAULT_AGENTS_PATH = path.join('.agents', 'agents');

/**
 * LocalRepositoryStrategy — reads packages from a directory on disk.
 *
 * Delegates entry matching and metadata extraction to registered
 * IComponentPlugin instances (SkillPlugin, AgentPlugin, …), so new
 * component types are picked up automatically without modifying this file.
 *
 * Source config:
 *   type: 'local'
 *   path: '.'                    (relative to projectRoot, default '.')
 *   skillsPath: '.agents/skills' (relative to source root, default shown)
 *   agentsPath: '.agents/agents' (relative to source root, default shown)
 *   namespace: 'myteam'          (optional name prefix)
 *   singleResource: true         (entire source root is one skill package)
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
    );
    const agents = this.scanDir(
      path.join(sourceRoot, source.agentsPath ?? DEFAULT_AGENTS_PATH),
      PackageType.AGENT,
      source,
    );
    return [...skills, ...agents];
  }

  getLocalPath(pkg: ApmPackage, source: ApmSource, _cacheDir: string, projectRoot: string): string {
    const sourceRoot = this.resolveRoot(source, projectRoot);
    if (source.singleResource) return sourceRoot;
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

  /**
   * Scan a directory for all packages of a given type.
   * Delegates entry detection and metadata to the registered IComponentPlugin.
   * Falls back to a built-in scan when no component plugin is registered for the type.
   */
  private scanDir(dir: string, type: PackageType, source: ApmSource): ApmPackage[] {
    if (!fs.existsSync(dir)) return [];
    const pkgs: ApmPackage[] = [];

    if (hasComponent(type)) {
      const component = getComponent(type);
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!component.matchEntry(entry, dir)) continue;
        const entryPath = path.join(dir, entry.name);
        const meta      = component.readMeta(entryPath, entry.name);
        // For agents the component stores baseName separately (entry.name includes .md).
        const baseName  = (meta as { _baseName?: string })._baseName ?? entry.name;
        pkgs.push({
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
        });
      }
    }
    return pkgs.sort((a, b) => a.name.localeCompare(b.name));
  }

  private scanSingle(source: ApmSource, sourceRoot: string): ApmPackage[] {
    if (!hasComponent(PackageType.SKILL)) return [];
    const component = getComponent(PackageType.SKILL);
    const name      = this.withNs(source.namespace, source.resourceName ?? source.name);
    const meta      = component.readMeta(sourceRoot, source.resourceName ?? source.name);
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
