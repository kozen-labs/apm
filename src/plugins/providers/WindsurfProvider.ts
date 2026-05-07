import { access, writeFile, readdir, rm } from 'fs/promises';
import path from 'path';
import os from 'os';
import { IApmPackage } from '../../models/IApmPackage';
import { IInstalledPackage } from '../../models/IInstalledPackage';
import { PackageType } from '../../models/PackageType';
import { Provider } from '../../models/Provider';
import { Scope } from '../../models/Scope';
import { IApmSource } from '../../models/IApmSource';
import { IComponentOps } from '../../models/IComponentOps';
import { IRepository } from '../../models/IRepository';
import { IProvider } from '../../models/IProvider';
import { parseFrontmatterAsync, stripFrontmatterAsync } from '../../utils/frontmatter';
import { bareSkillName } from '../../utils/pkg';

export class WindsurfProvider implements IProvider {
  readonly name: string;

  constructor() {
    this.name = Provider.WINDSURF;
  }

  getInstallPath(scope: Scope, projectRoot: string, customDir?: string): string {
    if (customDir) return customDir;
    return scope === Scope.GLOBAL
      ? path.join(os.homedir(), '.windsurf', 'rules')
      : path.join(projectRoot, '.windsurf', 'rules');
  }

  async install(pkg: IApmPackage, repo: IRepository, source: IApmSource, _component: IComponentOps, installPath: string, cacheDir: string, projectRoot: string): Promise<void> {
    if (pkg.type === PackageType.AGENT) return;
    const localPath = await repo.getLocalPath(pkg, source, cacheDir, projectRoot);
    const skillMd   = path.join(localPath, 'SKILL.md');
    try { await access(skillMd); } catch { throw new Error(`SKILL.md not found at ${skillMd}`); }
    const body    = await stripFrontmatterAsync(skillMd);
    const desc    = pkg.description.replace(/"/g, "'").replace(/\n/g, ' ').trim().slice(0, 120);
    const content = `---\ndescription: "${desc}"\nupdated: "${pkg.updated}"\n---\n\n${body}`;
    await writeFile(
      path.join(installPath, `${bareSkillName(pkg.name)}.windsurfrules`),
      content,
      'utf-8',
    );
  }

  async uninstall(name: string, _component: IComponentOps, installPath: string): Promise<void> {
    const p = path.join(installPath, `${bareSkillName(name)}.windsurfrules`);
    try { await access(p); } catch { throw Object.assign(new Error(`Not found: ${p}`), { code: 'ENOENT' }); }
    await rm(p, { force: true });
  }

  async listInstalled(installPath: string, component: IComponentOps, sourceMap: Map<string, string>): Promise<IInstalledPackage[]> {
    if (component.type === PackageType.AGENT) return [];
    let files: string[];
    try {
      files = await readdir(installPath);
    } catch {
      return [];
    }
    const results = await Promise.all(
      files
        .filter(f => f.endsWith('.windsurfrules') && f.startsWith('ks-'))
        .map(async f => {
          const name             = f.replace(/\.windsurfrules$/, '');
          const fm               = await parseFrontmatterAsync(path.join(installPath, f));
          const installedUpdated = String(fm.updated ?? '');
          const sourceUpdated    = sourceMap.get(name) ?? '';
          return {
            name, type: component.type,
            provider:     Provider.WINDSURF,
            scope:        Scope.LOCAL,
            installPath:  path.join(installPath, f),
            updated:      installedUpdated,
            sourceUpdated,
            isOutdated: !!sourceUpdated && !!installedUpdated && sourceUpdated > installedUpdated,
          } satisfies IInstalledPackage;
        }),
    );
    return results;
  }

  async postInstall(): Promise<void> { /* no-op */ }
}
