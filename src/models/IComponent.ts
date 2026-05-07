import type { Dirent } from 'fs';
import type { IApmPackage } from './IApmPackage';
import type { IApmManifest } from './IApmManifest';
import type { IInstalledMeta } from './IInstalledMeta';
import type { IInstalledPackage } from './IInstalledPackage';
import type { IOperationResult } from './IOperationResult';
import type { PackageType } from './PackageType';
import type { IComponentBaseOpts } from './IComponentBaseOpts';
import type { IComponentInstallOpts } from './IComponentInstallOpts';
import type { IComponentSetupOpts } from './IComponentSetupOpts';
import type { IComponentRefreshOpts } from './IComponentRefreshOpts';

/**
 * IComponent — microkernel extension point for a single artifact type.
 *
 * File operations (type-specific, abstract in BaseComponent):
 *   matchEntry, readMeta, copyTo, removeFrom, listFrom
 *
 * Action methods (shared via BaseComponent, overridable per type):
 *   install, uninstall, list, status, outdated, setup, manifest, refresh
 *
 * IoC key: apm:plugin:component:<type>
 */
export interface IComponent {
  readonly type:          PackageType;
  readonly installSubdir: string;

  matchEntry(entry: Dirent, parentDir: string): Promise<boolean>;
  readMeta(entryPath: string, entryName: string): Promise<Partial<IApmPackage>>;
  copyTo(srcPath: string, bareName: string, installDir: string): Promise<void>;
  removeFrom(bareName: string, installDir: string): Promise<void>;
  listFrom(installDir: string, sourceMap: Map<string, string>): Promise<IInstalledMeta[]>;

  install(opts: IComponentInstallOpts): Promise<IOperationResult>;
  uninstall(opts: IComponentInstallOpts): Promise<IOperationResult>;
  list(opts: IComponentBaseOpts): Promise<IApmPackage[]>;
  status(opts: IComponentBaseOpts): Promise<IInstalledPackage[]>;
  outdated(opts: IComponentBaseOpts): Promise<IInstalledPackage[]>;
  setup(opts: IComponentSetupOpts): Promise<void>;
  manifest(opts: IComponentBaseOpts): Promise<IApmManifest>;
  refresh(opts: IComponentRefreshOpts): Promise<void>;
}
