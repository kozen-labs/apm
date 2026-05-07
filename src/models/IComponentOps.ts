import type { Dirent } from 'fs';
import type { PackageType } from './PackageType';
import type { IInstalledMeta } from './IInstalledMeta';

/**
 * Minimal file-operation contract required by providers to install/uninstall/list artifacts.
 * Defined in models to avoid a circular import between providers and components layers.
 */
export interface IComponentOps {
  readonly type: PackageType;
  copyTo(srcPath: string, bareName: string, installDir: string): Promise<void>;
  removeFrom(bareName: string, installDir: string): Promise<void>;
  listFrom(installDir: string, sourceMap: Map<string, string>): Promise<IInstalledMeta[]>;
}
