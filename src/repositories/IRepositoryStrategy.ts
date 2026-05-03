import { ApmPackage } from '../models/package.model';
import { ApmSource } from '../models/config.model';

/**
 * Repository strategy interface — Microkernel plugin contract.
 *
 * Each implementation handles one source type (local, github, npm, …).
 * Register new source types without modifying any existing code:
 *
 *   PluginRegistry.registerRepository(new MyCustomStrategy());
 *
 * All methods are synchronous. Implementations that need network access
 * (github, npm) perform blocking I/O via child_process.execSync or
 * Node.js built-ins.
 */
export interface IRepositoryStrategy {
  /** Matches ApmSource.type — used by PluginRegistry for dispatch. */
  readonly type: string;

  /**
   * Discover and return all packages available from this source.
   * Sets pkg.localPath and pkg.sourceRef on every returned package.
   *
   * @param source     Source configuration entry from apm.config.json.
   * @param cacheDir   Root directory for local caches (e.g. ~/apm.cache).
   * @param projectRoot Absolute path of the project root (used to resolve source.path).
   */
  list(source: ApmSource, cacheDir: string, projectRoot: string): ApmPackage[];

  /**
   * Return the absolute local path to a specific package's root directory.
   * For remote strategies, ensures the package is cached locally first.
   *
   * @param pkg        Package descriptor (name, path, sourceRef, …).
   * @param source     Source configuration this package belongs to.
   * @param cacheDir   Root directory for local caches.
   * @param projectRoot Absolute path of the project root.
   */
  getLocalPath(
    pkg: ApmPackage,
    source: ApmSource,
    cacheDir: string,
    projectRoot: string,
  ): string;

  /**
   * Refresh the local cache from the remote source.
   * No-op for local strategies.
   */
  refresh(source: ApmSource, cacheDir: string): void;

  /**
   * Return true when the cache may be outdated and refresh() should be called.
   * Always false for local strategies.
   */
  isStale(source: ApmSource, cacheDir: string): boolean;
}
