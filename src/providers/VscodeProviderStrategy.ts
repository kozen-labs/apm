import fs from 'fs';
import path from 'path';
import os from 'os';
import { ApmPackage, InstalledPackage } from '../models/package.model';
import { PackageType, Provider, Scope } from '../models/provider.model';
import { parseFrontmatter, stripFrontmatter } from '../utils/frontmatter';
import { IProviderStrategy } from './IProviderStrategy';

/**
 * VscodeProviderStrategy — installs to Cursor's .cursor/rules/ as .mdc files.
 *
 * local scope:  <projectRoot>/.cursor/rules/
 * global scope: ~/.cursor/rules/
 *
 * Skills are converted: SKILL.md frontmatter → Cursor description + globs header,
 * body content → .mdc body.
 * Agents are not supported by this provider (Cursor uses .mdc rules only).
 */
export class VscodeProviderStrategy implements IProviderStrategy {
  readonly name = Provider.VSCODE;

  getInstallPath(scope: Scope, projectRoot: string, customDir?: string): string {
    if (customDir) return customDir;
    return scope === Scope.GLOBAL
      ? path.join(os.homedir(), '.cursor', 'rules')
      : path.join(projectRoot,  '.cursor', 'rules');
  }

  install(pkg: ApmPackage, pkgLocalPath: string, installPath: string): void {
    if (pkg.type === PackageType.AGENT) return; // agents not supported for vscode

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
    const mdc = `---\ndescription: "${desc}"\nglobs: \nalwaysApply: false\n---\n\n${body}`;
    fs.writeFileSync(path.join(installPath, `${pkg.name}.mdc`), mdc, 'utf-8');
  }

  uninstall(name: string, _type: PackageType, installPath: string): void {
    const p = path.join(installPath, `${name}.mdc`);
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  }

  listInstalled(
    installPath: string,
    type: PackageType,
    sourceMap: Map<string, string>,
  ): InstalledPackage[] {
    if (!fs.existsSync(installPath) || type === PackageType.AGENT) return [];
    const out: InstalledPackage[] = [];

    for (const f of fs.readdirSync(installPath)) {
      if (!f.endsWith('.mdc') || !f.startsWith('ks-')) continue;
      const name = f.replace(/\.mdc$/, '');
      const fm   = parseFrontmatter(path.join(installPath, f));
      const installedUpdated = String(fm.updated ?? '');
      const sourceUpdated    = sourceMap.get(name) ?? '';
      out.push({
        name, type,
        provider: Provider.VSCODE,
        scope:    Scope.LOCAL,   // caller sets correct scope
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
