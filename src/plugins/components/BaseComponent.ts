import fs   from 'fs';
import path from 'path';
import os   from 'os';
import { BaseService } from '@kozen/engine';
import { ApmPackage, ApmManifest, InstalledMeta, InstalledPackage, OperationResult } from '../../models/package.model';
import { PackageType, Provider, Scope } from '../../models/provider.model';
import {
  ComponentBaseOpts,
  ComponentInstallOpts,
  ComponentSetupOpts,
  ComponentRefreshOpts,
} from '../../models/component.model';
import { ApmConfigManager }   from '../../services/config';
import { ApmLockManager }     from '../../services/lock';
import { ApmManifestManager } from '../../services/manifest';
import { IProvider }          from '../providers/IProvider';
import { IRepository }        from '../repositories/IRepository';
import { IComponent }         from './IComponent';
import { bareSkillName }      from '../../utils/pkg';

const DEFAULT_CACHE_DIR = path.join(os.homedir(), 'apm.cache');

/**
 * BaseComponent — orchestrates repository (source) → provider (destination) for one artifact type.
 *
 * Subclasses implement the type-specific file operations: matchEntry, readMeta,
 * copyTo, removeFrom, listFrom. All shared action logic lives here.
 *
 * IoC injection: assistant (IIoC) resolves providers and repositories by token at runtime.
 * No static registries — providers and repositories are resolved from the IoC container.
 */
export abstract class BaseComponent extends BaseService implements IComponent {

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
    const provider  = this.assistant!.resolveSync<IProvider>(`apm:plugin:provider:${opts.provider}`);
    const target    = provider.getInstallPath(opts.scope, opts.projectRoot, opts.customDir);
    const available = this.listAvailable(config, opts.projectRoot);
    const toInstall = opts.names.length
      ? available.filter(p => opts.names.includes(p.name))
      : available;

    for (const n of opts.names.filter(n => !available.find(p => p.name === n))) {
      this.logger?.warn({ src: 'BaseComponent', message: `${this.type} not found in source registry: ${n}` });
    }
    if (!toInstall.length) {
      this.logger?.error({ src: 'BaseComponent', message: `No matching ${this.type}s found` });
      process.exit(1);
    }

    fs.mkdirSync(target, { recursive: true });
    const result = emptyResult(target);
    const t0     = performance.now();
    const allSources = config.getAllSources();

    for (const pkg of toInstall) {
      const source = allSources.find(s => s.name === pkg.sourceRef) ?? allSources.find(s => s.type === 'local');
      try {
        const repo = this.assistant!.resolveSync<IRepository>(`apm:plugin:repository:${source!.type}`);
        provider.install(pkg, repo, source!, this, target, DEFAULT_CACHE_DIR, opts.projectRoot);
        this.logger?.info({ src: 'BaseComponent', message: `installed ${pkg.name}` });
        result.succeeded.push(pkg.name);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger?.error({ src: 'BaseComponent', message: `${pkg.name}: ${msg}` });
        result.errors.push([pkg.name, msg]);
      }
    }

    try {
      provider.postInstall(target, config.getPrimarySourceRoot());
    } catch (err) {
      this.logger?.warn({ src: 'BaseComponent', message: `postInstall skipped: ${err}` });
    }

    result.elapsed = (performance.now() - t0) / 1000;
    this.syncLockAfterInstall(result, opts, config);
    return result;
  }

  uninstall(opts: ComponentInstallOpts): OperationResult {
    const config   = new ApmConfigManager(opts.projectRoot);
    const provider = this.assistant!.resolveSync<IProvider>(`apm:plugin:provider:${opts.provider}`);
    const target   = provider.getInstallPath(opts.scope, opts.projectRoot, opts.customDir);
    const names    = opts.names.length
      ? opts.names
      : this.listInstalled(config, opts.projectRoot)
          .filter(p => p.provider === opts.provider && p.scope === opts.scope)
          .map(p => p.name);

    if (!names.length) {
      this.logger?.info({ src: 'BaseComponent', message: `Nothing installed at ${opts.provider}/${opts.scope}` });
      return emptyResult(target);
    }
    if (!fs.existsSync(target)) {
      this.logger?.warn({ src: 'BaseComponent', message: `Install path does not exist: ${target}` });
      return emptyResult(target);
    }

    const result = emptyResult(target);
    const t0     = performance.now();

    for (const name of names) {
      try {
        provider.uninstall(name, this, target);
        this.logger?.info({ src: 'BaseComponent', message: `removed ${name}` });
        result.succeeded.push(name);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          result.skipped.push(name);
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger?.error({ src: 'BaseComponent', message: `${name}: ${msg}` });
          result.errors.push([name, msg]);
        }
      }
    }

    result.elapsed = (performance.now() - t0) / 1000;
    if (result.succeeded.length) {
      try { new ApmLockManager(opts.projectRoot).removeEntries(result.succeeded, opts.provider, opts.scope); }
      catch { /* best-effort */ }
    }
    return result;
  }

  list(opts: ComponentBaseOpts): ApmPackage[] {
    return this.listAvailable(new ApmConfigManager(opts.projectRoot), opts.projectRoot);
  }

  status(opts: ComponentBaseOpts): InstalledPackage[] {
    const config    = new ApmConfigManager(opts.projectRoot);
    const installed = this.listInstalled(config, opts.projectRoot);
    if (installed.length) new ApmLockManager(opts.projectRoot).writeAll(installed);
    return installed;
  }

  outdated(opts: ComponentBaseOpts): InstalledPackage[] {
    const config    = new ApmConfigManager(opts.projectRoot);
    const installed = this.listInstalled(config, opts.projectRoot);
    if (installed.length) new ApmLockManager(opts.projectRoot).writeAll(installed);
    return installed.filter(p => p.isOutdated);
  }

  setup(opts: ComponentSetupOpts): void {
    const configManager = new ApmConfigManager(opts.projectRoot, opts.configPath);
    const lockManager   = new ApmLockManager(opts.projectRoot);

    if (configManager.read() !== null && !opts.force) {
      this.logger?.info({ src: 'BaseComponent', message: 'apm.pack.json already exists (use --force to overwrite)' });
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
      this.logger?.info({ src: 'BaseComponent', message: `apm.pack.json written (${configManager.getConfigPath()})` });
    }

    if (lockManager.read() === null || opts.force) {
      lockManager.writeAll([]);
      this.logger?.info({ src: 'BaseComponent', message: 'apm.lock.json written' });
    }

    if (fs.existsSync(path.join(opts.projectRoot, '.agents'))) {
      const manifestManager = new ApmManifestManager(new ApmConfigManager(opts.projectRoot).getPrimarySourceRoot());
      const manifest = manifestManager.generate();
      manifestManager.write(manifest);
      const { skills, agents } = manifest.packages;
      this.logger?.info({ src: 'BaseComponent', message: `.agents/apm.json written — ${skills.length} skills, ${agents.length} agents` });
    }
  }

  manifest(opts: ComponentBaseOpts): ApmManifest {
    const config   = new ApmConfigManager(opts.projectRoot);
    const manager  = new ApmManifestManager(config.getPrimarySourceRoot());
    const manifest = manager.generate();
    manager.write(manifest);
    return manifest;
  }

  refresh(opts: ComponentRefreshOpts): void {
    const config  = new ApmConfigManager(opts.projectRoot);
    const sources = opts.sourceName
      ? config.getAllSources().filter(s => s.name === opts.sourceName)
      : config.getAllSources().filter(s => s.type !== 'local');

    if (opts.sourceName && sources.length === 0) {
      this.logger?.error({ src: 'BaseComponent', message: `Source "${opts.sourceName}" not found` });
      process.exit(1);
    }

    for (const source of sources) {
      try {
        const repo = this.assistant!.resolveSync<IRepository>(`apm:plugin:repository:${source.type}`);
        repo.refresh(source, DEFAULT_CACHE_DIR);
        this.logger?.info({ src: 'BaseComponent', message: `refreshed: ${source.name}` });
      } catch (err) {
        this.logger?.warn({ src: 'BaseComponent', message: `${source.name}: ${err instanceof Error ? err.message : String(err)}` });
      }
    }
  }

  // ── private ───────────────────────────────────────────────────────────────

  private listAvailable(config: ApmConfigManager, projectRoot: string): ApmPackage[] {
    const all: ApmPackage[] = [];
    for (const source of config.getEnabledSources()) {
      try {
        const repo = this.assistant!.resolveSync<IRepository>(`apm:plugin:repository:${source.type}`);
        all.push(...repo.list(source, DEFAULT_CACHE_DIR, projectRoot, this));
      } catch { /* skip unregistered or unavailable sources */ }
    }
    return all.filter(p => p.type === this.type);
  }

  private listInstalled(config: ApmConfigManager, projectRoot: string): InstalledPackage[] {
    const available   = this.listAvailable(config, projectRoot);
    const sourceMap   = new Map(available.map(p => [bareSkillName(p.name), p.updated]));
    const sourcePaths = this.getSourcePaths(config, projectRoot);
    const installed: InstalledPackage[] = [];

    for (const providerName of Object.values(Provider)) {
      try {
        const provider = this.assistant!.resolveSync<IProvider>(`apm:plugin:provider:${providerName}`);
        for (const scope of [Scope.LOCAL, Scope.GLOBAL]) {
          const installPath = provider.getInstallPath(scope, projectRoot);
          if (!fs.existsSync(installPath) || sourcePaths.has(path.resolve(installPath))) continue;
          const pkgs = provider.listInstalled(installPath, this, sourceMap);
          for (const pkg of pkgs) installed.push({ ...pkg, scope });
        }
      } catch { /* skip unregistered providers */ }
    }
    return installed;
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

  private syncLockAfterInstall(result: OperationResult, opts: ComponentInstallOpts, config: ApmConfigManager): void {
    if (!result.succeeded.length) return;
    try {
      const installed = this.listInstalled(config, opts.projectRoot)
        .filter(p => p.provider === opts.provider && p.scope === opts.scope);
      new ApmLockManager(opts.projectRoot).mergeForTarget(installed, opts.provider, opts.scope);
    } catch { /* best-effort */ }
  }
}

function emptyResult(target: string): OperationResult {
  return { succeeded: [], skipped: [], errors: [], elapsed: 0, target };
}
