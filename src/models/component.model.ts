import type { Dirent } from 'fs';
import { Provider, Scope, PackageType } from './provider.model';
import { ApmPackage, InstalledMeta } from './package.model';

/**
 * Minimal file-operation contract required by providers to install/uninstall/list artifacts.
 * Defined here (in models) to avoid a circular import between the providers and components layers.
 */
export interface IComponentOps {
  readonly type: PackageType;
  copyTo(srcPath: string, bareName: string, installDir: string): void;
  removeFrom(bareName: string, installDir: string): void;
  listFrom(installDir: string, sourceMap: Map<string, string>): InstalledMeta[];
}

/**
 * Minimal scanning contract required by repositories to discover artifacts on disk.
 * Defined here (in models) to avoid a cross-plugin import between repositories and components.
 */
export interface IComponentScanner {
  readonly type: PackageType;
  matchEntry(entry: Dirent, parentDir: string): boolean;
  readMeta(entryPath: string, entryName: string): Partial<ApmPackage>;
}

export interface ComponentBaseOpts {
  projectRoot: string;
}

export interface ComponentInstallOpts extends ComponentBaseOpts {
  provider:   Provider;
  scope:      Scope;
  names:      string[];
  customDir?: string;
}

export interface ComponentSetupOpts extends ComponentBaseOpts {
  provider:        string;
  scope:           string;
  enableCommunity: boolean;
  force:           boolean;
  configPath?:     string;
}

export interface ComponentRefreshOpts extends ComponentBaseOpts {
  sourceName?: string;
}
