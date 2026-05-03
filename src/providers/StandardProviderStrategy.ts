import fs from 'fs';
import path from 'path';
import os from 'os';
import { ApmPackage, InstalledPackage } from '../models/package.model';
import { PackageType, Provider, Scope } from '../models/provider.model';
import { parseFrontmatter } from '../utils/frontmatter';
import { bareSkillName } from '../utils/pkg';
import { IProviderStrategy } from './IProviderStrategy';

/**
 * StandardProviderStrategy — installs to the tool-agnostic .agents/ tree.
 *
 * local scope:  <projectRoot>/.agents/skills|agents/
 * global scope: ~/.agents/skills|agents/
 *
 * Skills are copied as full directory trees.
 * Agents are copied as .md files.
 */
export class StandardProviderStrategy implements IProviderStrategy {
  readonly name = Provider.STANDARD;

  getInstallPath(scope: Scope, projectRoot: string, customDir?: string): string {
    if (customDir) return customDir;
    return scope === Scope.GLOBAL
      ? path.join(os.homedir(), '.agents', 'skills')
      : path.join(projectRoot,  '.agents', 'skills');
  }

  getAgentInstallPath(scope: Scope, projectRoot: string, customDir?: string): string {
    if (customDir) return customDir;
    return scope === Scope.GLOBAL
      ? path.join(os.homedir(), '.agents', 'agents')
      : path.join(projectRoot,  '.agents', 'agents');
  }

  install(pkg: ApmPackage, pkgLocalPath: string, installPath: string): void {
    if (pkg.type === PackageType.AGENT) {
      const dst = path.join(installPath, path.basename(pkgLocalPath));
      fs.copyFileSync(pkgLocalPath, dst);
    } else {
      const dst = path.join(installPath, bareSkillName(pkg.name));
      if (this.samePath(dst, pkgLocalPath)) return;
      fs.rmSync(dst, { recursive: true, force: true });
      this.copyDir(pkgLocalPath, dst);
    }
  }

  uninstall(name: string, type: PackageType, installPath: string): void {
    const bare = bareSkillName(name);
    const p = type === PackageType.AGENT
      ? path.join(installPath, `${bare}.md`)
      : path.join(installPath, bare);
    if (!fs.existsSync(p)) {
      const err = Object.assign(new Error(`Not found: ${p}`), { code: 'ENOENT' });
      throw err;
    }
    fs.rmSync(p, { recursive: true, force: true });
  }

  listInstalled(
    installPath: string,
    type: PackageType,
    sourceMap: Map<string, string>,
  ): InstalledPackage[] {
    if (!fs.existsSync(installPath)) return [];
    const out: InstalledPackage[] = [];

    for (const entry of fs.readdirSync(installPath, { withFileTypes: true })) {
      const isSkill = type === PackageType.SKILL && entry.isDirectory() && entry.name.startsWith('ks-');
      const isAgent = type === PackageType.AGENT && entry.name.endsWith('.md');
      if (!isSkill && !isAgent) continue;

      const pkgPath  = path.join(installPath, entry.name);
      const metaFile = isSkill ? path.join(pkgPath, 'SKILL.md') : pkgPath;
      if (!fs.existsSync(metaFile)) continue;

      const fm   = parseFrontmatter(metaFile);
      const name = isAgent ? entry.name.replace(/\.md$/, '') : entry.name;
      const installedUpdated = String(fm.updated ?? '');
      const sourceUpdated    = sourceMap.get(name) ?? '';
      out.push({
        name, type,
        provider: Provider.STANDARD,
        scope:    Scope.LOCAL,   // caller sets correct scope
        installPath: pkgPath,
        updated:       installedUpdated,
        sourceUpdated,
        isOutdated: !!sourceUpdated && !!installedUpdated && sourceUpdated > installedUpdated,
      });
    }
    return out;
  }

  postInstall(): void { /* standard provider has no post-install hook */ }

  // ── private ──────────────────────────────────────────────────────────────

  private copyDir(src: string, dst: string): void {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, entry.name);
      const d = path.join(dst, entry.name);
      entry.isDirectory() ? this.copyDir(s, d) : fs.copyFileSync(s, d);
    }
  }

  private samePath(a: string, b: string): boolean {
    try { return path.resolve(a) === path.resolve(b); } catch { return false; }
  }
}
