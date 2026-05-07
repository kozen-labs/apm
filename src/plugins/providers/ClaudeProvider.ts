import { access, readFile, writeFile } from 'fs/promises';
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

export class ClaudeProvider implements IProvider {
  readonly name: string;

  constructor() {
    this.name = Provider.CLAUDE;
  }

  getInstallPath(scope: Scope, projectRoot: string, customDir?: string): string {
    if (customDir) return customDir;
    return scope === Scope.GLOBAL
      ? path.join(os.homedir(), '.claude', 'skills')
      : path.join(projectRoot,  '.claude', 'skills');
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
      provider:      Provider.CLAUDE,
      scope:         Scope.LOCAL,
      installPath:   e.installPath,
      updated:       e.installedUpdated,
      sourceUpdated: e.sourceUpdated,
      isOutdated:    e.isOutdated,
    }));
  }

  async postInstall(installPath: string, sourceRoot: string): Promise<void> {
    const src = path.join(sourceRoot, '.claude', 'manifest.json');
    try {
      await access(src);
    } catch {
      return;
    }
    try {
      let text = await readFile(src, 'utf-8');
      text = text.replace(/"\.\.\/\.agents\/skills\//g, '"');
      text = text.replace(/"\.\.\/\.claude\/skills\//g, '"');
      await writeFile(path.join(installPath, 'manifest.json'), text, 'utf-8');
    } catch {
      /* manifest.json is best-effort */
    }
  }
}
