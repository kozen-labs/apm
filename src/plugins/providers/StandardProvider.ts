import path from 'path';
import os from 'os';
import { ApmPackage, InstalledPackage } from '../../models/package.model';
import { Provider, Scope } from '../../models/provider.model';
import { ApmSource } from '../../models/config.model';
import { IComponentOps } from '../../models/component.model';
import { bareSkillName } from '../../utils/pkg';
import { IRepository } from '../repositories/IRepository';
import { IProvider } from './IProvider';

export class StandardProvider implements IProvider {
  readonly name = Provider.STANDARD;

  getInstallPath(scope: Scope, projectRoot: string, customDir?: string): string {
    if (customDir) return customDir;
    return scope === Scope.GLOBAL
      ? path.join(os.homedir(), '.agents', 'skills')
      : path.join(projectRoot,  '.agents', 'skills');
  }

  install(pkg: ApmPackage, repo: IRepository, source: ApmSource, component: IComponentOps, installPath: string, cacheDir: string, projectRoot: string): void {
    const localPath = repo.getLocalPath(pkg, source, cacheDir, projectRoot);
    component.copyTo(localPath, bareSkillName(pkg.name), installPath);
  }

  uninstall(name: string, component: IComponentOps, installPath: string): void {
    component.removeFrom(bareSkillName(name), installPath);
  }

  listInstalled(installPath: string, component: IComponentOps, sourceMap: Map<string, string>): InstalledPackage[] {
    return component.listFrom(installPath, sourceMap).map(e => ({
      name:          e.name,
      type:          component.type,
      provider:      Provider.STANDARD,
      scope:         Scope.LOCAL,
      installPath:   e.installPath,
      updated:       e.installedUpdated,
      sourceUpdated: e.sourceUpdated,
      isOutdated:    e.isOutdated,
    }));
  }

  postInstall(): void { /* no-op */ }
}
