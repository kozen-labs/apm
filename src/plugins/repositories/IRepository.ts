import { ApmPackage } from '../../models/package.model';
import { ApmSource } from '../../models/config.model';

export interface IRepository {
  readonly type: string;
  list(source: ApmSource, cacheDir: string, projectRoot: string): ApmPackage[];
  getLocalPath(pkg: ApmPackage, source: ApmSource, cacheDir: string, projectRoot: string): string;
  refresh(source: ApmSource, cacheDir: string): void;
  isStale(source: ApmSource, cacheDir: string): boolean;
}
