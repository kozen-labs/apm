import fs   from 'fs';
import path from 'path';
import os   from 'os';
import { ApmPackage, ApmManifest, InstalledMeta, InstalledPackage, OperationResult } from '../../models/package.model';
import { PackageType } from '../../models/provider.model';
import { ApmConfigManager, CONFIG_FILENAME } from '../../utils/config';
import { ApmLockManager, LOCK_FILENAME }     from '../../utils/lock';
import { ApmManifestManager }                from '../../utils/manifest';
import { ApmRegistry }                       from './registry';
import { ApmInstaller }                      from './installer';
import * as PluginRegistry                   from '../PluginRegistry';
import * as log                              from '../../utils/log';
import {
  IComponentPlugin,
  ComponentBaseOpts,
  ComponentInstallOpts,
  ComponentSetupOpts,
  ComponentRefreshOpts,
} from './IComponentPlugin';

const DEFAULT_CACHE_DIR = path.join(os.homedir(), 'apm.cache');

/**
 * BaseComponentPlugin — shared action implementations for all component types.
 *
 * Subclasses override only the type-specific file operations:
 *   matchEntry, readMeta, copyTo, removeFrom, listFrom
 *
 * Action methods (install, uninstall, list, status, outdated, setup,
 * manifest, refresh) are fully implemented here and shared by all types.
 * Override them only when a component type needs genuinely different behaviour.
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
    const registry  = new ApmRegistry(opts.projectRoot);
    const installer = new ApmInstaller(opts.projectRoot);
    const lock      = new ApmLockManager(opts.projectRoot);
    const available = registry.getAvailable(this.type);

    const toInstall = opts.names.length
      ? available.filter(p => opts.names.includes(p.name))
      : available;

    const missing = opts.names.filter(n => !available.find(p => p.name === n));
    for (const m of missing) log.warn(`${this.type} not found in source registry: ${m}`);

    if (!toInstall.length) {
      log.error(`No matching ${this.type}s found. Run 'apm list --component ${this.type}' to see available packages.`);
      process.exit(1);
    }

    log.section(`Installing ${toInstall.length} ${this.type}(s)`);
    const result = installer.install(toInstall, opts.provider, opts.scope, opts.customDir);

    if (result.succeeded.length) {
      try {
        const installed = registry.getInstalled(this.type)
          .filter(p => p.provider === opts.provider && p.scope === opts.scope);
        lock.mergeForTarget(installed, opts.provider, opts.scope);
      } catch { /* lock update is best-effort */ }
    }

    return result;
  }

  uninstall(opts: ComponentInstallOpts): OperationResult {
    const registry  = new ApmRegistry(opts.projectRoot);
    const installer = new ApmInstaller(opts.projectRoot);
    const lock      = new ApmLockManager(opts.projectRoot);

    let names = opts.names;
    if (!names.length) {
      names = registry.getInstalled(this.type)
        .filter(p => p.provider === opts.provider && p.scope === opts.scope)
        .map(p => p.name);

      if (!names.length) {
        log.info(`Nothing installed at ${opts.provider}/${opts.scope}.`);
        return { succeeded: [], skipped: [], errors: [], elapsed: 0, target: '' };
      }
    }

    log.section(`Uninstalling ${names.length} ${this.type}(s)`);
    const result = installer.uninstall(names, this.type, opts.provider, opts.scope, opts.customDir);

    if (result.succeeded.length) {
      try {
        lock.removeEntries(result.succeeded, opts.provider, opts.scope);
      } catch { /* lock update is best-effort */ }
    }

    return result;
  }

  list(opts: ComponentBaseOpts): ApmPackage[] {
    return new ApmRegistry(opts.projectRoot).getAvailable(this.type);
  }

  status(opts: ComponentBaseOpts): InstalledPackage[] {
    const registry  = new ApmRegistry(opts.projectRoot);
    const installed = registry.getInstalled(this.type);

    if (installed.length) {
      new ApmLockManager(opts.projectRoot).writeAll(installed);
    }

    return installed;
  }

  outdated(opts: ComponentBaseOpts): InstalledPackage[] {
    const registry  = new ApmRegistry(opts.projectRoot);
    const installed = registry.getInstalled(this.type);

    if (installed.length) {
      new ApmLockManager(opts.projectRoot).writeAll(installed);
    }

    return installed.filter(p => p.isOutdated);
  }

  setup(opts: ComponentSetupOpts): void {
    log.section('APM — Initialize project');

    const configManager = new ApmConfigManager(opts.projectRoot, opts.configPath);
    const lockManager   = new ApmLockManager(opts.projectRoot);
    const configExists  = configManager.read() !== null;

    if (configExists && !opts.force) {
      log.skip(`${CONFIG_FILENAME} already exists  (use --force to overwrite)`);
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
      log.ok(`${CONFIG_FILENAME} written  (${configManager.getConfigPath()})`);

      if (opts.enableCommunity) {
        log.detail('Community sources enabled. Run `apm refresh` to clone them.');
      }
    }

    const lockExists = lockManager.read() !== null;
    if (lockExists && !opts.force) {
      log.skip(`${LOCK_FILENAME} already exists`);
    } else {
      lockManager.writeAll([]);
      log.ok(`${LOCK_FILENAME} written  (empty — run \`apm status\` to populate)`);
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
    log.detail(`Edit ${CONFIG_FILENAME} to add or enable sources, then run \`apm list\` to see available packages.`);
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
      log.error(`Source "${opts.sourceName}" not found in ${CONFIG_FILENAME}`);
      process.exit(1);
    }

    if (targets.length === 0) {
      log.info('No remote sources configured. Nothing to refresh.');
      return;
    }

    for (const source of targets) {
      if (!PluginRegistry.hasRepository(source.type)) {
        log.warn(`No strategy registered for source type "${source.type}" — skipping "${source.name}"`);
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
}
