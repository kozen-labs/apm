import fs from 'fs';
import path from 'path';
import os from 'os';
import { ApmPackage, OperationResult } from '../models/package.model';
import { PackageType, Provider, Scope } from '../models/provider.model';
import { ApmSource } from '../models/config.model';
import { ApmConfigManager } from './config';
import * as PluginRegistry from './PluginRegistry';
import * as log from '../utils/log';

const DEFAULT_CACHE_DIR = path.join(os.homedir(), 'apm.cache');

/**
 * ApmInstaller — installs and uninstalls packages using provider strategies.
 *
 * Delegates all provider-specific logic (copy, convert, post-install) to the
 * registered IProviderStrategy for the target provider.
 * Resolves package source paths via the registered IRepositoryStrategy,
 * using pkg.localPath as a fast-path when available (set by list() calls).
 */
export class ApmInstaller {
  private configManager: ApmConfigManager;
  private cacheDir: string;

  constructor(private readonly projectRoot: string, cacheDir?: string) {
    this.configManager = new ApmConfigManager(projectRoot);
    this.cacheDir      = cacheDir ?? DEFAULT_CACHE_DIR;
  }

  install(
    packages: ApmPackage[],
    provider: Provider,
    scope: Scope,
    customDir?: string,
  ): OperationResult {
    const strategy = PluginRegistry.getProvider(provider);
    const target   = strategy.getInstallPath(scope, this.projectRoot, customDir);

    this.guardSourceOverwrite(packages, target);
    fs.mkdirSync(target, { recursive: true });

    const result = this.emptyResult(target);
    const t0     = performance.now();

    log.info(`Target: ${target}`);
    console.log();

    for (const pkg of packages) {
      try {
        const pkgLocalPath = this.resolveLocalPath(pkg);
        strategy.install(pkg, pkgLocalPath, target);
        log.ok(pkg.name);
        result.succeeded.push(pkg.name);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error(`${pkg.name}  →  ${msg}`);
        result.errors.push([pkg.name, msg]);
      }
    }

    try {
      strategy.postInstall(target, this.configManager.getPrimarySourceRoot());
      if (provider === Provider.CLAUDE) log.ok('manifest.json written');
    } catch (err) {
      log.warn(`postInstall skipped: ${err}`);
    }

    result.elapsed = (performance.now() - t0) / 1000;
    log.summary(result.succeeded, result.skipped, result.errors, result.elapsed, result.target);
    return result;
  }

  uninstall(
    names: string[],
    type: PackageType,
    provider: Provider,
    scope: Scope,
    customDir?: string,
  ): OperationResult {
    const strategy = PluginRegistry.getProvider(provider);
    const target   = strategy.getInstallPath(scope, this.projectRoot, customDir);
    const result   = this.emptyResult(target);
    const t0       = performance.now();

    log.info(`Target: ${target}`);
    console.log();

    if (!fs.existsSync(target)) {
      log.warn(`Install path does not exist: ${target}`);
      result.elapsed = (performance.now() - t0) / 1000;
      return result;
    }

    for (const name of names) {
      try {
        strategy.uninstall(name, type, target);
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
    return result;
  }

  // ── private helpers ───────────────────────────────────────────────────────

  /**
   * Resolve the local filesystem path for a package.
   * Uses pkg.localPath when set (populated by strategy.list()).
   * Otherwise looks up the source from pkg.sourceRef and calls getLocalPath().
   */
  private resolveLocalPath(pkg: ApmPackage): string {
    if (pkg.localPath) return pkg.localPath;

    const source = this.findSource(pkg.sourceRef);
    if (!source) {
      // Last-resort fallback: primary local source, standard .agents/ layout.
      const root = this.configManager.getPrimarySourceRoot();
      return path.resolve(root, '.agents', pkg.path);
    }
    const strategy = PluginRegistry.getRepository(source.type);
    return strategy.getLocalPath(pkg, source, this.cacheDir, this.projectRoot);
  }

  private findSource(sourceRef: string | undefined): ApmSource | undefined {
    const all = this.configManager.getAllSources();
    if (sourceRef) {
      const match = all.find(s => s.name === sourceRef);
      if (match) return match;
    }
    // Fall back to first local source.
    return all.find(s => s.type === 'local');
  }

  private guardSourceOverwrite(packages: ApmPackage[], target: string): void {
    for (const pkg of packages) {
      try {
        const localPath = this.resolveLocalPath(pkg);
        if (path.resolve(target) === path.resolve(path.dirname(localPath))) {
          log.warn(
            `Install target "${target}" appears to be the source directory for "${pkg.name}". ` +
            'Copies may overwrite the source.',
          );
        }
      } catch {
        // Ignore resolution errors during guard check.
      }
    }
  }

  private emptyResult(target: string): OperationResult {
    return { succeeded: [], skipped: [], errors: [], elapsed: 0, target };
  }
}
