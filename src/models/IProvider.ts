import type { IApmPackage } from './IApmPackage';
import type { IInstalledPackage } from './IInstalledPackage';
import type { IApmSource } from './IApmSource';
import type { IComponentOps } from './IComponentOps';
import type { IRepository } from './IRepository';
import type { Scope } from './Scope';

/**
 * Provider — knows WHERE and HOW to install artifacts for a specific AI tool.
 *
 * The provider drives the full install cycle: it fetches the local path from the
 * repository and performs all format-specific file operations (direct copy, .mdc
 * conversion, etc.). Callers pass the component for type-specific copy helpers.
 *
 * IoC key: apm:plugin:provider:<name>
 */
export interface IProvider {
  readonly name: string;

  getInstallPath(scope: Scope, projectRoot: string, customDir?: string): string;

  install(
    pkg: IApmPackage,
    repo: IRepository,
    source: IApmSource,
    component: IComponentOps,
    installPath: string,
    cacheDir: string,
    projectRoot: string,
  ): Promise<void>;

  uninstall(name: string, component: IComponentOps, installPath: string): Promise<void>;

  listInstalled(
    installPath: string,
    component: IComponentOps,
    sourceMap: Map<string, string>,
  ): Promise<IInstalledPackage[]>;

  postInstall(installPath: string, sourceRoot: string): Promise<void>;
}
