import fs from 'fs';
import path from 'path';
import os from 'os';
import { ApmPackage, InstalledPackage } from '../../models/package.model';
import { PackageType, Scope } from '../../models/provider.model';
import { ApmManifestManager } from '../../utils/manifest';
import { ApmConfigManager } from '../../utils/config';
import * as PluginRegistry from '../PluginRegistry';
import { bareSkillName } from '../../utils/pkg';

const DEFAULT_CACHE_DIR = path.join(os.homedir(), 'apm.cache');

export class ApmRegistry {
  private configManager: ApmConfigManager;
  private manifestManager: ApmManifestManager;
  private cacheDir: string;

  constructor(private readonly projectRoot: string, cacheDir?: string) {
    this.configManager   = new ApmConfigManager(projectRoot);
    const sourceRoot     = this.configManager.getPrimarySourceRoot();
    this.manifestManager = new ApmManifestManager(sourceRoot);
    this.cacheDir        = cacheDir ?? DEFAULT_CACHE_DIR;
  }

  getAvailable(type: PackageType = PackageType.SKILL): ApmPackage[] {
    const sources = this.configManager.getEnabledSources();

    if (sources.length === 1 && sources[0].type === 'local') {
      const manifest = this.manifestManager.read();
      if (manifest) {
        return this.filterByType(
          [...manifest.packages.skills, ...(manifest.packages.agents ?? [])],
          type,
        );
      }
      const generated = this.manifestManager.generate();
      return this.filterByType(
        [...generated.packages.skills, ...(generated.packages.agents ?? [])],
        type,
      );
    }

    const all: ApmPackage[] = [];
    for (const source of sources) {
      if (!PluginRegistry.hasRepository(source.type)) continue;
      try {
        const repo = PluginRegistry.getRepository(source.type);
        const pkgs = repo.list(source, this.cacheDir, this.projectRoot);
        all.push(...pkgs);
      } catch (err) {
        console.warn(`  [warn] Failed to list source "${source.name}": ${String(err)}`);
      }
    }
    return this.filterByType(all, type);
  }

  getInstalled(type: PackageType = PackageType.SKILL): InstalledPackage[] {
    const available  = this.getAvailable(type);
    const sourceMap  = new Map(available.map(p => [bareSkillName(p.name), p.updated]));
    const sourcePaths = this.getSourcePaths();
    const installed: InstalledPackage[] = [];

    for (const providerName of PluginRegistry.listProviderNames()) {
      const provider = PluginRegistry.getProvider(providerName);
      for (const scope of [Scope.LOCAL, Scope.GLOBAL]) {
        const installPath = provider.getInstallPath(scope, this.projectRoot);
        if (!fs.existsSync(installPath)) continue;
        if (sourcePaths.has(path.resolve(installPath))) continue;

        const pkgs = provider.listInstalled(installPath, type, sourceMap);
        for (const pkg of pkgs) {
          installed.push({ ...pkg, scope });
        }
      }
    }
    return installed;
  }

  // ── private ──────────────────────────────────────────────────────────────

  private filterByType(pkgs: ApmPackage[], type: PackageType): ApmPackage[] {
    if (type === PackageType.SKILL) return pkgs.filter(p => p.type === PackageType.SKILL);
    if (type === PackageType.AGENT) return pkgs.filter(p => p.type === PackageType.AGENT);
    return pkgs;
  }

  private getSourcePaths(): Set<string> {
    const paths: string[] = [];
    for (const source of this.configManager.getEnabledSources()) {
      if (source.type !== 'local') continue;
      const root = path.resolve(this.projectRoot, source.path ?? '.');
      paths.push(
        path.join(root, source.skillsPath ?? path.join('.agents', 'skills')),
        path.join(root, source.agentsPath ?? path.join('.agents', 'agents')),
        path.join(root, '.claude', 'skills'),
        path.join(root, '.claude', 'agents'),
      );
    }
    return new Set(paths.map(p => path.resolve(p)));
  }
}
