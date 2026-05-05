import { ApmPackage, InstalledPackage } from '../../models/package.model';
import { PackageType, Scope } from '../../models/provider.model';

export interface IProvider {
  readonly name: string;
  getInstallPath(scope: Scope, projectRoot: string, customDir?: string): string;
  install(pkg: ApmPackage, pkgLocalPath: string, installPath: string): void;
  uninstall(name: string, type: PackageType, installPath: string): void;
  listInstalled(installPath: string, type: PackageType, sourceMap: Map<string, string>): InstalledPackage[];
  postInstall(installPath: string, sourceRoot: string): void;
}
