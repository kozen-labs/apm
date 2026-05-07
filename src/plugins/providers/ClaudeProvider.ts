import fs from 'fs';
import path from 'path';
import os from 'os';
import { ApmPackage, InstalledPackage } from '../../models/package.model';
import { Provider, Scope } from '../../models/provider.model';
import { ApmSource } from '../../models/config.model';
import { IComponentOps } from '../../models/component.model';
import { bareSkillName } from '../../utils/pkg';
import { IRepository } from '../repositories/IRepository';
import { IProvider } from './IProvider';

export class ClaudeProvider implements IProvider {
  readonly name = Provider.CLAUDE;

  getInstallPath(scope: Scope, projectRoot: string, customDir?: string): string {
    if (customDir) return customDir;
    return scope === Scope.GLOBAL
      ? path.join(os.homedir(), '.claude', 'skills')
      : path.join(projectRoot,  '.claude', 'skills');
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
      provider:      Provider.CLAUDE,
      scope:         Scope.LOCAL,
      installPath:   e.installPath,
      updated:       e.installedUpdated,
      sourceUpdated: e.sourceUpdated,
      isOutdated:    e.isOutdated,
    }));
  }

  postInstall(installPath: string, sourceRoot: string): void {
    const src = path.join(sourceRoot, '.claude', 'manifest.json');
    if (!fs.existsSync(src)) return;
    try {
      let text = fs.readFileSync(src, 'utf-8');
      text = text.replace(/"\.\.\/\.agents\/skills\//g, '"');
      text = text.replace(/"\.\.\/\.claude\/skills\//g, '"');
      fs.writeFileSync(path.join(installPath, 'manifest.json'), text, 'utf-8');
    } catch {
      // manifest.json is best-effort
    }
  }
}
