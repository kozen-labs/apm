import { ApmPackage, InstalledPackage } from '../../models/package.model';
import { Scope } from '../../models/provider.model';
import { ApmSource } from '../../models/config.model';
import { IComponentOps } from '../../models/component.model';
import { IRepository } from '../repositories/IRepository';

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
    pkg: ApmPackage,
    repo: IRepository,
    source: ApmSource,
    component: IComponentOps,
    installPath: string,
    cacheDir: string,
    projectRoot: string,
  ): void;

  uninstall(name: string, component: IComponentOps, installPath: string): void;

  listInstalled(
    installPath: string,
    component: IComponentOps,
    sourceMap: Map<string, string>,
  ): InstalledPackage[];

  postInstall(installPath: string, sourceRoot: string): void;
}
