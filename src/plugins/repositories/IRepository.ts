import { ApmPackage } from '../../models/package.model';
import { ApmSource } from '../../models/config.model';
import { IComponentScanner } from '../../models/component.model';

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
  list(source: ApmSource, cacheDir: string, projectRoot: string, component: IComponentScanner): ApmPackage[];
  getLocalPath(pkg: ApmPackage, source: ApmSource, cacheDir: string, projectRoot: string): string;
  refresh(source: ApmSource, cacheDir: string): void;
  isStale(source: ApmSource, cacheDir: string): boolean;
}
