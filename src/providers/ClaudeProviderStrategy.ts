import fs from 'fs';
import path from 'path';
import os from 'os';
import { ApmPackage, InstalledPackage } from '../models/package.model';
import { PackageType, Provider, Scope } from '../models/provider.model';
import { parseFrontmatter } from '../utils/frontmatter';
import { IProviderStrategy } from './IProviderStrategy';

/**
 * ClaudeProviderStrategy — installs to the .claude/skills|agents/ tree.
 *
 * local scope:  <projectRoot>/.claude/skills|agents/
 * global scope: ~/.claude/skills|agents/
 *
 * Skills are copied as full directory trees (same as standard).
 * Agents are copied as .md files.
 * postInstall rewrites and copies manifest.json so Claude Code
 * can discover the skills via its plugin registry.
 */
export class ClaudeProviderStrategy implements IProviderStrategy {
  readonly name = Provider.CLAUDE;

  getInstallPath(scope: Scope, projectRoot: string, customDir?: string): string {
    if (customDir) return customDir;
    return scope === Scope.GLOBAL
      ? path.join(os.homedir(), '.claude', 'skills')
      : path.join(projectRoot,  '.claude', 'skills');
  }

  install(pkg: ApmPackage, pkgLocalPath: string, installPath: string): void {
    if (pkg.type === PackageType.AGENT) {
      const dst = path.join(installPath, path.basename(pkgLocalPath));
      fs.copyFileSync(pkgLocalPath, dst);
    } else {
      const dst = path.join(installPath, pkg.name);
      if (this.samePath(dst, pkgLocalPath)) return;
      fs.rmSync(dst, { recursive: true, force: true });
      this.copyDir(pkgLocalPath, dst);
    }
  }

  uninstall(name: string, type: PackageType, installPath: string): void {
    const p = type === PackageType.AGENT
      ? path.join(installPath, `${name}.md`)
      : path.join(installPath, name);
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
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
        provider: Provider.CLAUDE,
        scope:    Scope.LOCAL,   // caller sets correct scope
        installPath: pkgPath,
        updated:       installedUpdated,
        sourceUpdated,
        isOutdated: !!sourceUpdated && !!installedUpdated && sourceUpdated > installedUpdated,
      });
    }
    return out;
  }

  /**
   * Rewrites path prefixes in manifest.json so paths are relative to the
   * install directory, then copies it next to the installed skills.
   */
  postInstall(installPath: string, sourceRoot: string): void {
    const src = path.join(sourceRoot, '.claude', 'manifest.json');
    if (!fs.existsSync(src)) return;
    try {
      let text = fs.readFileSync(src, 'utf-8');
      text = text.replace(/"\.\.\/\.agents\/skills\//g, '"');
      text = text.replace(/"\.\.\/\.claude\/skills\//g, '"');
      fs.writeFileSync(path.join(installPath, 'manifest.json'), text, 'utf-8');
    } catch {
      // manifest.json is best-effort — don't fail the install.
    }
  }

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
