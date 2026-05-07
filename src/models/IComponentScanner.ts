import type { Dirent } from 'fs';
import type { PackageType } from './PackageType';
import type { IApmPackage } from './IApmPackage';

/**
 * Minimal scanning contract required by repositories to discover artifacts on disk.
 * Defined in models to avoid a cross-plugin import between repositories and components.
 */
export interface IComponentScanner {
  readonly type: PackageType;
  matchEntry(entry: Dirent, parentDir: string): Promise<boolean>;
  readMeta(entryPath: string, entryName: string): Promise<Partial<IApmPackage>>;
}
