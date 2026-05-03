import { ApmPackage } from '../../models/package.model';
import { ApmSource } from '../../models/config.model';

/**
 * IRepositoryStrategy — Microkernel plugin contract for package sources.
 *
 * Each implementation handles one source type (local, github, npm, …).
 * Register new source types without modifying any existing code:
 *
 *   registerRepository(new MyCustomStrategy());
 *
 * All methods are synchronous. Implementations that need network access
 * (github, npm) perform blocking I/O via child_process.execSync.
 */
export interface IRepositoryStrategy {
  /** Matches ApmSource.type — used by PluginRegistry for dispatch. */
  readonly type: string;

  /**
   * Discover and return all packages available from this source.
   * Sets pkg.localPath and pkg.sourceRef on every returned package.
   */
  list(source: ApmSource, cacheDir: string, projectRoot: string): ApmPackage[];

  /**
   * Return the absolute local path to a specific package's root directory.
   * For remote strategies, ensures the package is cached locally first.
   */
  getLocalPath(pkg: ApmPackage, source: ApmSource, cacheDir: string, projectRoot: string): string;

  /** Refresh the local cache from the remote source. No-op for local strategies. */
  refresh(source: ApmSource, cacheDir: string): void;

  /** Return true when the cache may be outdated and refresh() should be called. */
  isStale(source: ApmSource, cacheDir: string): boolean;
}
