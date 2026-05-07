import type { IApmPackage } from './IApmPackage';
import type { IApmSource } from './IApmSource';
import type { IComponentScanner } from './IComponentScanner';

/**
 * Repository — knows WHERE packages live and how to retrieve them.
 *
 * The `component` parameter in `list()` provides type-specific scanning logic
 * (matchEntry, readMeta) so the repository can discover artifacts on disk
 * without depending on the component plugin layer directly.
 *
 * IoC key: apm:plugin:repository:<type>
 */
export interface IRepository {
  readonly type: string;
  list(source: IApmSource, cacheDir: string, projectRoot: string, component: IComponentScanner): Promise<IApmPackage[]>;
  getLocalPath(pkg: IApmPackage, source: IApmSource, cacheDir: string, projectRoot: string): Promise<string>;
  refresh(source: IApmSource, cacheDir: string): Promise<void>;
  isStale(source: IApmSource, cacheDir: string): Promise<boolean>;
}
