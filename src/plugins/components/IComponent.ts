import fs from 'fs';
import { ApmPackage, ApmManifest, InstalledMeta, InstalledPackage, OperationResult } from '../../models/package.model';
import { PackageType } from '../../models/provider.model';
import {
  ComponentBaseOpts,
  ComponentInstallOpts,
  ComponentSetupOpts,
  ComponentRefreshOpts,
} from '../../models/component.model';

export type {
  ComponentBaseOpts,
  ComponentInstallOpts,
  ComponentSetupOpts,
  ComponentRefreshOpts,
};

/**
 * IComponent — microkernel extension point for a single artifact type.
 *
 * File operations (type-specific, abstract in BaseComponent):
 *   matchEntry, readMeta, copyTo, removeFrom, listFrom
 *
 * Action methods (shared via BaseComponent, overridable per type):
 *   install, uninstall, list, status, outdated, setup, manifest, refresh
 *
 * IoC key:   apm:plugin:component:<type>
 * Registry:  registerComponent(new Skill())
 */
export interface IComponent {
  readonly type:         PackageType;
  readonly installSubdir: string;

  matchEntry(entry: fs.Dirent, parentDir: string): boolean;
  readMeta(entryPath: string, entryName: string): Partial<ApmPackage>;
  copyTo(srcPath: string, bareName: string, installDir: string): void;
  removeFrom(bareName: string, installDir: string): void;
  listFrom(installDir: string, sourceMap: Map<string, string>): InstalledMeta[];

  install(opts: ComponentInstallOpts): OperationResult;
  uninstall(opts: ComponentInstallOpts): OperationResult;
  list(opts: ComponentBaseOpts): ApmPackage[];
  status(opts: ComponentBaseOpts): InstalledPackage[];
  outdated(opts: ComponentBaseOpts): InstalledPackage[];
  setup(opts: ComponentSetupOpts): void;
  manifest(opts: ComponentBaseOpts): ApmManifest;
  refresh(opts: ComponentRefreshOpts): void;
}
