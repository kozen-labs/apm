import path from 'path';
import os from 'os';
import { IApmPackage } from '../../models/IApmPackage';
import { IInstalledPackage } from '../../models/IInstalledPackage';
import { Provider } from '../../models/Provider';
import { Scope } from '../../models/Scope';
import { IApmSource } from '../../models/IApmSource';
import { IComponentOps } from '../../models/IComponentOps';
import { IRepository } from '../../models/IRepository';
import { IProvider } from '../../models/IProvider';
import { bareSkillName } from '../../utils/pkg';

export class StandardProvider implements IProvider {
  readonly name: string;

  constructor() {
    this.name = Provider.STANDARD;
  }

  getInstallPath(scope: Scope, projectRoot: string, customDir?: string): string {
    if (customDir) return customDir;
    return scope === Scope.GLOBAL
      ? path.join(os.homedir(), '.agents', 'skills')
      : path.join(projectRoot,  '.agents', 'skills');
  }

  async install(pkg: IApmPackage, repo: IRepository, source: IApmSource, component: IComponentOps, installPath: string, cacheDir: string, projectRoot: string): Promise<void> {
    const localPath = await repo.getLocalPath(pkg, source, cacheDir, projectRoot);
    await component.copyTo(localPath, bareSkillName(pkg.name), installPath);
  }

  async uninstall(name: string, component: IComponentOps, installPath: string): Promise<void> {
    await component.removeFrom(bareSkillName(name), installPath);
  }

  async listInstalled(installPath: string, component: IComponentOps, sourceMap: Map<string, string>): Promise<IInstalledPackage[]> {
    const entries = await component.listFrom(installPath, sourceMap);
    return entries.map(e => ({
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

  async postInstall(): Promise<void> { /* no-op */ }
}
