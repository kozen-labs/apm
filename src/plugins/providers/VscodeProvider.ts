import path from 'path';
import os from 'os';
import { ApmPackage, InstalledPackage } from '../../models/package.model';
import { PackageType, Provider, Scope } from '../../models/provider.model';
import { bareSkillName } from '../../utils/pkg';
import { getComponent } from '../PluginRegistry';
import { IProvider } from './IProvider';

export class VscodeProvider implements IProvider {
  readonly name = Provider.VSCODE;

  getInstallPath(scope: Scope, projectRoot: string, customDir?: string): string {
    if (customDir) return customDir;
    return scope === Scope.GLOBAL
      ? path.join(os.homedir(), '.vscode', 'skills')
      : path.join(projectRoot,  '.vscode', 'skills');
  }

  install(pkg: ApmPackage, pkgLocalPath: string, installPath: string): void {
    getComponent(pkg.type).copyTo(pkgLocalPath, bareSkillName(pkg.name), installPath);
  }

  uninstall(name: string, type: PackageType, installPath: string): void {
    getComponent(type).removeFrom(bareSkillName(name), installPath);
  }

  listInstalled(installPath: string, type: PackageType, sourceMap: Map<string, string>): InstalledPackage[] {
    return getComponent(type).listFrom(installPath, sourceMap).map(e => ({
      name:          e.name,
      type,
      provider:      Provider.VSCODE,
      scope:         Scope.LOCAL,
      installPath:   e.installPath,
      updated:       e.installedUpdated,
      sourceUpdated: e.sourceUpdated,
      isOutdated:    e.isOutdated,
    }));
  }

  postInstall(): void { /* no-op */ }
}
