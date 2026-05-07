import type { Dirent } from 'fs';
import { mkdir, access } from 'fs/promises';
import path from 'path';
import os from 'os';
import { BaseService } from '@kozen/engine';
import { IApmPackage } from '../../models/IApmPackage';
import { IApmManifest } from '../../models/IApmManifest';
import { IInstalledMeta } from '../../models/IInstalledMeta';
import { IInstalledPackage } from '../../models/IInstalledPackage';
import { IOperationResult } from '../../models/IOperationResult';
import { PackageType } from '../../models/PackageType';
import { Provider } from '../../models/Provider';
import { Scope } from '../../models/Scope';
import { IComponentBaseOpts } from '../../models/IComponentBaseOpts';
import { IComponentInstallOpts } from '../../models/IComponentInstallOpts';
import { IComponentSetupOpts } from '../../models/IComponentSetupOpts';
import { IComponentRefreshOpts } from '../../models/IComponentRefreshOpts';
import { IProvider } from '../../models/IProvider';
import { IRepository } from '../../models/IRepository';
import { IComponent } from '../../models/IComponent';
import { ApmConfigManager } from '../../services/config';
import { ApmLockManager } from '../../services/lock';
import { ApmManifestManager } from '../../services/manifest';
import { bareSkillName } from '../../utils/pkg';

const DEFAULT_CACHE_DIR = path.join(os.homedir(), 'apm.cache');

/**
 * BaseComponent — orchestrates repository (source) → provider (destination) for one artifact type.
 *
 * Subclasses implement the type-specific file operations: matchEntry, readMeta,
 * copyTo, removeFrom, listFrom. All shared action logic lives here.
 *
 * IoC injection: assistant (IIoC) resolves providers and repositories by token at runtime.
 */
export abstract class BaseComponent extends BaseService implements IComponent {

  abstract readonly type:          PackageType;
  abstract readonly installSubdir: string;

  abstract matchEntry(entry: Dirent, parentDir: string): Promise<boolean>;
  abstract readMeta(entryPath: string, entryName: string): Promise<Partial<IApmPackage>>;
  abstract copyTo(srcPath: string, bareName: string, installDir: string): Promise<void>;
  abstract removeFrom(bareName: string, installDir: string): Promise<void>;
  abstract listFrom(installDir: string, sourceMap: Map<string, string>): Promise<IInstalledMeta[]>;

  // ── Action methods ────────────────────────────────────────────────────────

  async install(opts: IComponentInstallOpts): Promise<IOperationResult> {
    const config    = new ApmConfigManager(opts.projectRoot);
    const provider  = this.assistant!.resolveSync<IProvider>(`apm:plugin:provider:${opts.provider}`);
    const target    = provider.getInstallPath(opts.scope, opts.projectRoot, opts.customDir);
    const available = await this.listAvailable(config, opts.projectRoot);
    const toInstall = opts.names.length
      ? available.filter(p => opts.names.includes(p.name))
      : available;

    for (const n of opts.names.filter(n => !available.find(p => p.name === n))) {
      this.logger?.warn({ src: 'apm:BaseComponent:install', message: `${this.type} not found in source registry: ${n}` });
    }
    if (!toInstall.length) {
      this.logger?.error({ src: 'apm:BaseComponent:install', message: `No matching ${this.type}s found` });
      process.exit(1);
    }

    await mkdir(target, { recursive: true });
    const result = emptyResult(target);
    const t0     = performance.now();
    const allSources = await config.getAllSources();

    for (const pkg of toInstall) {
      const source = allSources.find(s => s.name === pkg.sourceRef) ?? allSources.find(s => s.type === 'local');
      try {
        const repo = this.assistant!.resolveSync<IRepository>(`apm:plugin:repository:${source!.type}`);
        await provider.install(pkg, repo, source!, this, target, DEFAULT_CACHE_DIR, opts.projectRoot);
        this.logger?.info({ src: 'apm:BaseComponent:install', message: `installed ${pkg.name}` });
        result.succeeded.push(pkg.name);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger?.error({ src: 'apm:BaseComponent:install', message: `${pkg.name}: ${msg}` });
        result.errors.push([pkg.name, msg]);
      }
    }

    try {
      const primaryRoot = await config.getPrimarySourceRoot();
      await provider.postInstall(target, primaryRoot);
    } catch (err) {
      this.logger?.warn({ src: 'apm:BaseComponent:install', message: `postInstall skipped: ${err instanceof Error ? err.message : String(err)}` });
    }

    result.elapsed = (performance.now() - t0) / 1000;
    await this.syncLockAfterInstall(result, opts, config);
    return result;
  }

  async uninstall(opts: IComponentInstallOpts): Promise<IOperationResult> {
    const config   = new ApmConfigManager(opts.projectRoot);
    const provider = this.assistant!.resolveSync<IProvider>(`apm:plugin:provider:${opts.provider}`);
    const target   = provider.getInstallPath(opts.scope, opts.projectRoot, opts.customDir);
    const names    = opts.names.length
      ? opts.names
      : (await this.listInstalled(config, opts.projectRoot))
          .filter(p => p.provider === opts.provider && p.scope === opts.scope)
          .map(p => p.name);

    if (!names.length) {
      this.logger?.info({ src: 'apm:BaseComponent:uninstall', message: `Nothing installed at ${opts.provider}/${opts.scope}` });
      return emptyResult(target);
    }
    try { await access(target); } catch {
      this.logger?.warn({ src: 'apm:BaseComponent:uninstall', message: `Install path does not exist: ${target}` });
      return emptyResult(target);
    }

    const result = emptyResult(target);
    const t0     = performance.now();

    for (const name of names) {
      try {
        await provider.uninstall(name, this, target);
        this.logger?.info({ src: 'apm:BaseComponent:uninstall', message: `removed ${name}` });
        result.succeeded.push(name);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          result.skipped.push(name);
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger?.error({ src: 'apm:BaseComponent:uninstall', message: `${name}: ${msg}` });
          result.errors.push([name, msg]);
        }
      }
    }

    result.elapsed = (performance.now() - t0) / 1000;
    if (result.succeeded.length) {
      try { await new ApmLockManager(opts.projectRoot).removeEntries(result.succeeded, opts.provider, opts.scope); }
      catch { /* best-effort */ }
    }
    return result;
  }

  async list(opts: IComponentBaseOpts): Promise<IApmPackage[]> {
    return this.listAvailable(new ApmConfigManager(opts.projectRoot), opts.projectRoot);
  }

  async status(opts: IComponentBaseOpts): Promise<IInstalledPackage[]> {
    const config    = new ApmConfigManager(opts.projectRoot);
    const installed = await this.listInstalled(config, opts.projectRoot);
    if (installed.length) await new ApmLockManager(opts.projectRoot).writeAll(installed);
    return installed;
  }

  async outdated(opts: IComponentBaseOpts): Promise<IInstalledPackage[]> {
    const config    = new ApmConfigManager(opts.projectRoot);
    const installed = await this.listInstalled(config, opts.projectRoot);
    if (installed.length) await new ApmLockManager(opts.projectRoot).writeAll(installed);
    return installed.filter(p => p.isOutdated);
  }

  async setup(opts: IComponentSetupOpts): Promise<void> {
    const configManager = new ApmConfigManager(opts.projectRoot, opts.configPath);
    const lockManager   = new ApmLockManager(opts.projectRoot);

    const existing = await configManager.read();
    if (existing !== null && !opts.force) {
      this.logger?.info({ src: 'apm:BaseComponent:setup', message: 'apm.pack.json already exists (use --force to overwrite)' });
    } else {
      const config = await configManager.getOrCreate();
      config.defaultProvider = opts.provider;
      config.defaultScope    = opts.scope;
      if (opts.enableCommunity) {
        for (const s of config.sources) {
          if (s.type === 'github') s.enabled = true;
        }
      }
      await configManager.write(config);
      this.logger?.info({ src: 'apm:BaseComponent:setup', message: `apm.pack.json written (${configManager.getConfigPath()})` });
    }

    const existingLock = await lockManager.read();
    if (existingLock === null || opts.force) {
      await lockManager.writeAll([]);
      this.logger?.info({ src: 'apm:BaseComponent:setup', message: 'apm.lock.json written' });
    }

    const agentsDir = path.join(opts.projectRoot, '.agents');
    try {
      await access(agentsDir);
      const primaryRoot    = await new ApmConfigManager(opts.projectRoot).getPrimarySourceRoot();
      const manifestManager = new ApmManifestManager(primaryRoot);
      const manifest        = await manifestManager.generate();
      await manifestManager.write(manifest);
      const { skills, agents } = manifest.packages;
      this.logger?.info({ src: 'apm:BaseComponent:setup', message: `.agents/apm.json written — ${skills.length} skills, ${agents.length} agents` });
    } catch { /* .agents dir does not exist — skip manifest generation */ }
  }

  async manifest(opts: IComponentBaseOpts): Promise<IApmManifest> {
    const config      = new ApmConfigManager(opts.projectRoot);
    const primaryRoot = await config.getPrimarySourceRoot();
    const manager     = new ApmManifestManager(primaryRoot);
    const manifest    = await manager.generate();
    await manager.write(manifest);
    return manifest;
  }

  async refresh(opts: IComponentRefreshOpts): Promise<void> {
    const config  = new ApmConfigManager(opts.projectRoot);
    const sources = opts.sourceName
      ? (await config.getAllSources()).filter(s => s.name === opts.sourceName)
      : (await config.getAllSources()).filter(s => s.type !== 'local');

    if (opts.sourceName && sources.length === 0) {
      this.logger?.error({ src: 'apm:BaseComponent:refresh', message: `Source "${opts.sourceName}" not found` });
      process.exit(1);
    }

    for (const source of sources) {
      try {
        const repo = this.assistant!.resolveSync<IRepository>(`apm:plugin:repository:${source.type}`);
        await repo.refresh(source, DEFAULT_CACHE_DIR);
        this.logger?.info({ src: 'apm:BaseComponent:refresh', message: `refreshed: ${source.name}` });
      } catch (err) {
        this.logger?.warn({ src: 'apm:BaseComponent:refresh', message: `${source.name}: ${err instanceof Error ? err.message : String(err)}` });
      }
    }
  }

  // ── private ───────────────────────────────────────────────────────────────

  private async listAvailable(config: ApmConfigManager, projectRoot: string): Promise<IApmPackage[]> {
    const all: IApmPackage[] = [];
    for (const source of await config.getEnabledSources()) {
      try {
        const repo = this.assistant!.resolveSync<IRepository>(`apm:plugin:repository:${source.type}`);
        all.push(...await repo.list(source, DEFAULT_CACHE_DIR, projectRoot, this));
      } catch { /* skip unregistered or unavailable sources */ }
    }
    return all.filter(p => p.type === this.type);
  }

  private async listInstalled(config: ApmConfigManager, projectRoot: string): Promise<IInstalledPackage[]> {
    const available   = await this.listAvailable(config, projectRoot);
    const sourceMap   = new Map(available.map(p => [bareSkillName(p.name), p.updated]));
    const sourcePaths = await this.getSourcePaths(config, projectRoot);
    const installed: IInstalledPackage[] = [];

    for (const providerName of Object.values(Provider)) {
      try {
        const provider = this.assistant!.resolveSync<IProvider>(`apm:plugin:provider:${providerName}`);
        for (const scope of [Scope.LOCAL, Scope.GLOBAL]) {
          const installPath = provider.getInstallPath(scope, projectRoot);
          try { await access(installPath); } catch { continue; }
          if (sourcePaths.has(path.resolve(installPath))) continue;
          const pkgs = await provider.listInstalled(installPath, this, sourceMap);
          for (const pkg of pkgs) installed.push({ ...pkg, scope });
        }
      } catch { /* skip unregistered providers */ }
    }
    return installed;
  }

  private async getSourcePaths(config: ApmConfigManager, projectRoot: string): Promise<Set<string>> {
    const paths: string[] = [];
    for (const source of await config.getEnabledSources()) {
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

  private async syncLockAfterInstall(result: IOperationResult, opts: IComponentInstallOpts, config: ApmConfigManager): Promise<void> {
    if (!result.succeeded.length) return;
    try {
      const installed = (await this.listInstalled(config, opts.projectRoot))
        .filter(p => p.provider === opts.provider && p.scope === opts.scope);
      await new ApmLockManager(opts.projectRoot).mergeForTarget(installed, opts.provider, opts.scope);
    } catch { /* best-effort */ }
  }
}

function emptyResult(target: string): IOperationResult {
  return { succeeded: [], skipped: [], errors: [], elapsed: 0, target };
}
