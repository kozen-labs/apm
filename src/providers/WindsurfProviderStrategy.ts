import fs from 'fs';
import path from 'path';
import os from 'os';
import { ApmPackage, InstalledPackage } from '../models/package.model';
import { PackageType, Provider, Scope } from '../models/provider.model';
import { parseFrontmatter, stripFrontmatter } from '../utils/frontmatter';
import { bareSkillName } from '../utils/pkg';
import { IProviderStrategy } from './IProviderStrategy';

/**
 * WindsurfProviderStrategy — installs to Windsurf's .windsurf/rules/ directory.
 *
 * local scope:  <projectRoot>/.windsurf/rules/
 * global scope: ~/.windsurf/rules/
 *
 * Skills are converted: SKILL.md body content → .windsurfrules file.
 * Agents are not supported (Windsurf uses rule files only).
 */
export class WindsurfProviderStrategy implements IProviderStrategy {
  readonly name = Provider.WINDSURF;

  getInstallPath(scope: Scope, projectRoot: string, customDir?: string): string {
    if (customDir) return customDir;
    return scope === Scope.GLOBAL
      ? path.join(os.homedir(), '.windsurf', 'rules')
      : path.join(projectRoot, '.windsurf', 'rules');
  }

  install(pkg: ApmPackage, pkgLocalPath: string, installPath: string): void {
    if (pkg.type === PackageType.AGENT) return;

    const skillMd = path.join(pkgLocalPath, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
      throw new Error(`SKILL.md not found at ${skillMd}`);
    }

    const body = stripFrontmatter(skillMd);
    const desc = pkg.description
      .replace(/"/g, "'")
      .replace(/\n/g, ' ')
      .trim()
      .slice(0, 120);
    const content = `---\ndescription: "${desc}"\nupdated: "${pkg.updated}"\n---\n\n${body}`;
    fs.writeFileSync(
      path.join(installPath, `${bareSkillName(pkg.name)}.windsurfrules`),
      content,
      'utf-8',
    );
  }

  uninstall(name: string, _type: PackageType, installPath: string): void {
    const p = path.join(installPath, `${bareSkillName(name)}.windsurfrules`);
    if (!fs.existsSync(p)) {
      const err = Object.assign(new Error(`Not found: ${p}`), { code: 'ENOENT' });
      throw err;
    }
    fs.rmSync(p, { force: true });
  }

  listInstalled(
    installPath: string,
    type: PackageType,
    sourceMap: Map<string, string>,
  ): InstalledPackage[] {
    if (!fs.existsSync(installPath) || type === PackageType.AGENT) return [];
    const out: InstalledPackage[] = [];

    for (const f of fs.readdirSync(installPath)) {
      if (!f.endsWith('.windsurfrules') || !f.startsWith('ks-')) continue;
      const name = f.replace(/\.windsurfrules$/, '');
      const fm   = parseFrontmatter(path.join(installPath, f));
      const installedUpdated = String(fm.updated ?? '');
      const sourceUpdated    = sourceMap.get(name) ?? '';
      out.push({
        name, type,
        provider: Provider.WINDSURF,
        scope:    Scope.LOCAL,
        installPath: path.join(installPath, f),
        updated:       installedUpdated,
        sourceUpdated,
        isOutdated: !!sourceUpdated && !!installedUpdated && sourceUpdated > installedUpdated,
      });
    }
    return out;
  }

  postInstall(): void { /* no-op */ }
}
