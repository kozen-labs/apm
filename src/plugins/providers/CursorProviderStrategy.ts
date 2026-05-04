import fs from 'fs';
import path from 'path';
import os from 'os';
import { ApmPackage, InstalledPackage } from '../../models/package.model';
import { PackageType, Provider, Scope } from '../../models/provider.model';
import { parseFrontmatter, stripFrontmatter } from '../../utils/frontmatter';
import { bareSkillName } from '../../utils/pkg';
import { IProviderStrategy } from './IProviderStrategy';

/**
 * CursorProviderStrategy — installs to Cursor's .cursor/rules/ as .mdc files.
 *
 * local scope:  <projectRoot>/.cursor/rules/
 * global scope: ~/.cursor/rules/
 *
 * Skills are converted: SKILL.md frontmatter → Cursor description + globs header,
 * body content → .mdc body.
 * Agents are not supported (Cursor uses .mdc rule files only).
 *
 * Format conversion is Cursor-specific, so install/listInstalled are implemented
 * directly here rather than delegating to IComponentPlugin.
 */
export class CursorProviderStrategy implements IProviderStrategy {
  readonly name = Provider.CURSOR;

  getInstallPath(scope: Scope, projectRoot: string, customDir?: string): string {
    if (customDir) return customDir;
    return scope === Scope.GLOBAL
      ? path.join(os.homedir(), '.cursor', 'rules')
      : path.join(projectRoot, '.cursor', 'rules');
  }

  install(pkg: ApmPackage, pkgLocalPath: string, installPath: string): void {
    if (pkg.type === PackageType.AGENT) return;

    const skillMd = path.join(pkgLocalPath, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
      throw new Error(`SKILL.md not found at ${skillMd}`);
    }

    const body = stripFrontmatter(skillMd);
    const desc = pkg.description.replace(/"/g, "'").replace(/\n/g, ' ').trim().slice(0, 120);
    const mdc  = `---\ndescription: "${desc}"\nglobs: \nalwaysApply: false\n---\n\n${body}`;
    fs.writeFileSync(path.join(installPath, `${bareSkillName(pkg.name)}.mdc`), mdc, 'utf-8');
  }

  uninstall(name: string, _type: PackageType, installPath: string): void {
    const p = path.join(installPath, `${bareSkillName(name)}.mdc`);
    if (!fs.existsSync(p)) {
      throw Object.assign(new Error(`Not found: ${p}`), { code: 'ENOENT' });
    }
    fs.rmSync(p, { force: true });
  }

  listInstalled(installPath: string, type: PackageType, sourceMap: Map<string, string>): InstalledPackage[] {
    if (!fs.existsSync(installPath) || type === PackageType.AGENT) return [];
    const out: InstalledPackage[] = [];

    for (const f of fs.readdirSync(installPath)) {
      if (!f.endsWith('.mdc') || !f.startsWith('ks-')) continue;
      const name             = f.replace(/\.mdc$/, '');
      const fm               = parseFrontmatter(path.join(installPath, f));
      const installedUpdated = String(fm.updated ?? '');
      const sourceUpdated    = sourceMap.get(name) ?? '';
      out.push({
        name, type,
        provider:     Provider.CURSOR,
        scope:        Scope.LOCAL,
        installPath:  path.join(installPath, f),
        updated:      installedUpdated,
        sourceUpdated,
        isOutdated: !!sourceUpdated && !!installedUpdated && sourceUpdated > installedUpdated,
      });
    }
    return out;
  }

  postInstall(): void { /* no-op */ }
}
