import fs   from 'fs';
import path from 'path';
import os   from 'os';
import { ApmPackage, ApmManifest, InstalledMeta, InstalledPackage, OperationResult } from '../../models/package.model';
import { PackageType, Provider, Scope } from '../../models/provider.model';
import { ApmConfigManager } from '../../utils/config';
import { ApmLockManager }   from '../../utils/lock';
import { ApmManifestManager } from '../../utils/manifest';
import * as PluginRegistry   from '../PluginRegistry';
import * as log              from '../../utils/log';
import { bareSkillName }     from '../../utils/pkg';
import {
  IComponentPlugin,
  ComponentBaseOpts,
  ComponentInstallOpts,
  ComponentSetupOpts,
  ComponentRefreshOpts,
} from './IComponentPlugin';

const DEFAULT_CACHE_DIR = path.join(os.homedir(), 'apm.cache');
const CONFIG_FILE = 'apm.pack.json';
const LOCK_FILE   = 'apm.lock.json';

/**
 * BaseComponentPlugin — orchestrates between repository (where to get) and
 * provider (where/how to install). Subclasses override only the type-specific
 * file operations: matchEntry, readMeta, copyTo, removeFrom, listFrom.
 *
 * Flow:
 *   install()  → fetchAvailable() [repository] → provider.install() per package
 *   uninstall()→ provider.uninstall() per name
 *   list()     → fetchAvailable() [repository]
 *   status()   → fetchInstalled() [all providers]
 *   outdated() → fetchInstalled() filtered
 */
export abstract class BaseComponentPlugin implements IComponentPlugin {

  abstract readonly type:          PackageType;
  abstract readonly installSubdir: string;

  abstract matchEntry(entry: fs.Dirent, parentDir: string): boolean;
  abstract readMeta(entryPath: string, entryName: string): Partial<ApmPackage>;
  abstract copyTo(srcPath: string, bareName: string, installDir: string): void;
  abstract removeFrom(bareName: string, installDir: string): void;
  abstract listFrom(installDir: string, sourceMap: Map<string, string>): InstalledMeta[];

  // ── Action methods ────────────────────────────────────────────────────────

  install(opts: ComponentInstallOpts): OperationResult {
    const config    = new ApmConfigManager(opts.projectRoot);
    const provider  = PluginRegistry.getProvider(opts.provider);
    const target    = provider.getInstallPath(opts.scope, opts.projectRoot, opts.customDir);
    const available = this.fetchAvailable(config, opts.projectRoot);

    const toInstall = opts.names.length
      ? available.filter(p => opts.names.includes(p.name))
      : available;

    const missing = opts.names.filter(n => !available.find(p => p.name === n));
    for (const m of missing) log.warn(`${this.type} not found in source registry: ${m}`);

    if (!toInstall.length) {
      log.error(`No matching ${this.type}s found. Run 'apm list --component ${this.type}' to see available packages.`);
      process.exit(1);
    }

    this.guardSourceOverwrite(toInstall, target, config, opts.projectRoot);
    fs.mkdirSync(target, { recursive: true });

    const result = this.emptyResult(target);
    const t0     = performance.now();

    log.section(`Installing ${toInstall.length} ${this.type}(s)`);
    log.info(`Target: ${target}`);
    console.log();

    for (const pkg of toInstall) {
      try {
        const localPath = this.resolveLocalPath(pkg, config, opts.projectRoot);
        provider.install(pkg, localPath, target);
        log.ok(pkg.name);
        result.succeeded.push(pkg.name);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error(`${pkg.name}  →  ${msg}`);
        result.errors.push([pkg.name, msg]);
      }
    }

    try {
      provider.postInstall(target, config.getPrimarySourceRoot());
      if (opts.provider === Provider.CLAUDE) log.ok('manifest.json written');
    } catch (err) {
      log.warn(`postInstall skipped: ${err}`);
    }

    result.elapsed = (performance.now() - t0) / 1000;
    log.summary(result.succeeded, result.skipped, result.errors, result.elapsed, result.target);

    if (result.succeeded.length) {
      try {
        const installed = this.fetchInstalled(config, opts.projectRoot)
          .filter(p => p.provider === opts.provider && p.scope === opts.scope);
        new ApmLockManager(opts.projectRoot).mergeForTarget(installed, opts.provider, opts.scope);
      } catch { /* lock update is best-effort */ }
    }

    return result;
  }

  uninstall(opts: ComponentInstallOpts): OperationResult {
    const config   = new ApmConfigManager(opts.projectRoot);
    const provider = PluginRegistry.getProvider(opts.provider);
    const target   = provider.getInstallPath(opts.scope, opts.projectRoot, opts.customDir);

    let names = opts.names;
    if (!names.length) {
      names = this.fetchInstalled(config, opts.projectRoot)
        .filter(p => p.provider === opts.provider && p.scope === opts.scope)
        .map(p => p.name);

      if (!names.length) {
        log.info(`Nothing installed at ${opts.provider}/${opts.scope}.`);
        return this.emptyResult(target);
      }
    }

    const result = this.emptyResult(target);
    const t0     = performance.now();

    log.section(`Uninstalling ${names.length} ${this.type}(s)`);
    log.info(`Target: ${target}`);
    console.log();

    if (!fs.existsSync(target)) {
      log.warn(`Install path does not exist: ${target}`);
      result.elapsed = (performance.now() - t0) / 1000;
      return result;
    }

    for (const name of names) {
      try {
        provider.uninstall(name, this.type, target);
        log.ok(`removed  ${name}`);
        result.succeeded.push(name);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          log.skip(`${name}  (not found)`);
          result.skipped.push(name);
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          log.error(`${name}  →  ${msg}`);
          result.errors.push([name, msg]);
        }
      }
    }

    result.elapsed = (performance.now() - t0) / 1000;
    log.summary(result.succeeded, result.skipped, result.errors, result.elapsed, result.target);

    if (result.succeeded.length) {
      try {
        new ApmLockManager(opts.projectRoot).removeEntries(result.succeeded, opts.provider, opts.scope);
      } catch { /* lock update is best-effort */ }
    }

    return result;
  }

  list(opts: ComponentBaseOpts): ApmPackage[] {
    return this.fetchAvailable(new ApmConfigManager(opts.projectRoot), opts.projectRoot);
  }

  status(opts: ComponentBaseOpts): InstalledPackage[] {
    const config    = new ApmConfigManager(opts.projectRoot);
    const installed = this.fetchInstalled(config, opts.projectRoot);
    if (installed.length) new ApmLockManager(opts.projectRoot).writeAll(installed);
    return installed;
  }

  outdated(opts: ComponentBaseOpts): InstalledPackage[] {
    const config    = new ApmConfigManager(opts.projectRoot);
    const installed = this.fetchInstalled(config, opts.projectRoot);
    if (installed.length) new ApmLockManager(opts.projectRoot).writeAll(installed);
    return installed.filter(p => p.isOutdated);
  }

  setup(opts: ComponentSetupOpts): void {
    log.section('APM — Initialize project');

    const configManager = new ApmConfigManager(opts.projectRoot, opts.configPath);
    const lockManager   = new ApmLockManager(opts.projectRoot);
    const configExists  = configManager.read() !== null;

    if (configExists && !opts.force) {
      log.skip(`${CONFIG_FILE} already exists  (use --force to overwrite)`);
    } else {
      const config = configManager.getOrCreate();
      config.defaultProvider = opts.provider;
      config.defaultScope    = opts.scope;

      if (opts.enableCommunity) {
        for (const s of config.sources) {
          if (s.type === 'github') s.enabled = true;
        }
      }

      configManager.write(config);
      log.ok(`${CONFIG_FILE} written  (${configManager.getConfigPath()})`);
      if (opts.enableCommunity) log.detail('Community sources enabled. Run `apm refresh` to clone them.');
    }

    const lockExists = lockManager.read() !== null;
    if (lockExists && !opts.force) {
      log.skip(`${LOCK_FILE} already exists`);
    } else {
      lockManager.writeAll([]);
      log.ok(`${LOCK_FILE} written  (empty — run \`apm status\` to populate)`);
    }

    if (fs.existsSync(path.join(opts.projectRoot, '.agents'))) {
      const manifestManager = new ApmManifestManager(
        new ApmConfigManager(opts.projectRoot).getPrimarySourceRoot(),
      );
      const manifest = manifestManager.generate();
      manifestManager.write(manifest);
      const { skills, agents } = manifest.packages;
      log.ok(`.agents/apm.json written — ${skills.length} skills, ${agents.length} agents`);
    }

    console.log();
    log.detail(`Edit ${CONFIG_FILE} to add or enable sources, then run \`apm list\` to see available packages.`);
    console.log();
  }

  manifest(opts: ComponentBaseOpts): ApmManifest {
    const config   = new ApmConfigManager(opts.projectRoot);
    const manager  = new ApmManifestManager(config.getPrimarySourceRoot());
    const manifest = manager.generate();
    manager.write(manifest);
    return manifest;
  }

  refresh(opts: ComponentRefreshOpts): void {
    const config     = new ApmConfigManager(opts.projectRoot);
    const allSources = config.getAllSources();

    const targets = opts.sourceName
      ? allSources.filter(s => s.name === opts.sourceName)
      : allSources.filter(s => s.type !== 'local');

    if (opts.sourceName && targets.length === 0) {
      log.error(`Source "${opts.sourceName}" not found in ${CONFIG_FILE}`);
      process.exit(1);
    }

    if (targets.length === 0) {
      log.info('No remote sources configured. Nothing to refresh.');
      return;
    }

    for (const source of targets) {
      if (!PluginRegistry.hasRepository(source.type)) {
        log.warn(`No repository registered for source type "${source.type}" — skipping "${source.name}"`);
        continue;
      }
      log.info(`Refreshing "${source.name}" (${source.url ?? source.path ?? source.type})…`);
      try {
        PluginRegistry.getRepository(source.type).refresh(source, DEFAULT_CACHE_DIR);
        log.ok(source.name);
      } catch (err) {
        log.error(`${source.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    console.log();
  }

  // ── private ───────────────────────────────────────────────────────────────

  private fetchAvailable(config: ApmConfigManager, projectRoot: string): ApmPackage[] {
    const sources = config.getEnabledSources();

    if (sources.length === 1 && sources[0].type === 'local') {
      const manager  = new ApmManifestManager(config.getPrimarySourceRoot());
      const manifest = manager.read() ?? manager.generate();
      return this.filterByType([...manifest.packages.skills, ...(manifest.packages.agents ?? [])]);
    }

    const all: ApmPackage[] = [];
    for (const source of sources) {
      if (!PluginRegistry.hasRepository(source.type)) continue;
      try {
        const pkgs = PluginRegistry.getRepository(source.type).list(source, DEFAULT_CACHE_DIR, projectRoot);
        all.push(...pkgs);
      } catch (err) {
        console.warn(`  [warn] Failed to list source "${source.name}": ${String(err)}`);
      }
    }
    return this.filterByType(all);
  }

  private fetchInstalled(config: ApmConfigManager, projectRoot: string): InstalledPackage[] {
    const available   = this.fetchAvailable(config, projectRoot);
    const sourceMap   = new Map(available.map(p => [bareSkillName(p.name), p.updated]));
    const sourcePaths = this.getSourcePaths(config, projectRoot);
    const installed: InstalledPackage[] = [];

    for (const providerName of PluginRegistry.listProviderNames()) {
      const provider = PluginRegistry.getProvider(providerName);
      for (const scope of [Scope.LOCAL, Scope.GLOBAL]) {
        const installPath = provider.getInstallPath(scope, projectRoot);
        if (!fs.existsSync(installPath)) continue;
        if (sourcePaths.has(path.resolve(installPath))) continue;

        const pkgs = provider.listInstalled(installPath, this.type, sourceMap);
        for (const pkg of pkgs) installed.push({ ...pkg, scope });
      }
    }
    return installed;
  }

  private resolveLocalPath(pkg: ApmPackage, config: ApmConfigManager, projectRoot: string): string {
    if (pkg.localPath) return pkg.localPath;

    const all    = config.getAllSources();
    const source = (pkg.sourceRef ? all.find(s => s.name === pkg.sourceRef) : null)
                ?? all.find(s => s.type === 'local');

    if (!source) {
      return path.resolve(config.getPrimarySourceRoot(), '.agents', pkg.path);
    }
    return PluginRegistry.getRepository(source.type).getLocalPath(pkg, source, DEFAULT_CACHE_DIR, projectRoot);
  }

  private guardSourceOverwrite(packages: ApmPackage[], target: string, config: ApmConfigManager, projectRoot: string): void {
    for (const pkg of packages) {
      try {
        const localPath = this.resolveLocalPath(pkg, config, projectRoot);
        if (path.resolve(target) === path.resolve(path.dirname(localPath))) {
          log.warn(
            `Install target "${target}" appears to be the source directory for "${pkg.name}". ` +
            'Copies may overwrite the source.',
          );
        }
      } catch { /* ignore resolution errors during guard */ }
    }
  }

  private getSourcePaths(config: ApmConfigManager, projectRoot: string): Set<string> {
    const paths: string[] = [];
    for (const source of config.getEnabledSources()) {
      if (source.type !== 'local') continue;
      const root = path.resolve(projectRoot, source.path ?? '.');
      paths.push(
        path.join(root, source.skillsPath ?? path.join('.agents', 'skills')),
        path.join(root, source.agentsPath ?? path.join('.agents', 'agents')),
        path.join(root, '.claude', 'skills'),
        path.join(root, '.claude', 'agents'),
      );
    }
    return new Set(paths.map(p => path.resolve(p)));
  }

  private filterByType(pkgs: ApmPackage[]): ApmPackage[] {
    return pkgs.filter(p => p.type === this.type);
  }

  private emptyResult(target: string): OperationResult {
    return { succeeded: [], skipped: [], errors: [], elapsed: 0, target };
  }
}
