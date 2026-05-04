import fs from 'fs';
import path from 'path';
import { ApmPackage, InstalledMeta } from '../../models/package.model';
import { PackageType } from '../../models/provider.model';
import { parseFrontmatter } from '../../utils/frontmatter';
import { IComponentPlugin } from './IComponentPlugin';

/**
 * SkillPlugin — component plugin for ks-* skill directories.
 *
 * A skill is a directory whose name begins with 'ks-' and that contains
 * a SKILL.md file with YAML frontmatter (description, created, updated).
 *
 * Source layout:
 *   .agents/skills/
 *     ks-mongodb-core/
 *       SKILL.md          ← required
 *       references/       ← optional supporting files
 *
 * Default install layout (standard, claude providers):
 *   <installDir>/ks-mongodb-core/  (directory copy)
 */
export class SkillPlugin implements IComponentPlugin {
  readonly type        = PackageType.SKILL;
  readonly installSubdir = 'skills';

  matchEntry(entry: fs.Dirent, parentDir: string): boolean {
    if (!entry.isDirectory()) return false;
    if (!entry.name.startsWith('ks-')) return false;
    return fs.existsSync(path.join(parentDir, entry.name, 'SKILL.md'));
  }

  readMeta(entryPath: string, entryName: string): Partial<ApmPackage> {
    const fm = parseFrontmatter(path.join(entryPath, 'SKILL.md'));
    return {
      path:        entryName,
      description: String(fm.description ?? ''),
      created:     String(fm.created  ?? ''),
      updated:     String(fm.updated  ?? ''),
      version:     String(fm.version  ?? '1.0.0'),
    };
  }

  copyTo(srcPath: string, bareName: string, installDir: string): void {
    const dst = path.join(installDir, bareName);
    if (this.samePath(dst, srcPath)) return;
    fs.rmSync(dst, { recursive: true, force: true });
    this.copyDir(srcPath, dst);
  }

  removeFrom(bareName: string, installDir: string): void {
    const p = path.join(installDir, bareName);
    if (!fs.existsSync(p)) {
      throw Object.assign(new Error(`Not found: ${p}`), { code: 'ENOENT' });
    }
    fs.rmSync(p, { recursive: true, force: true });
  }

  listFrom(installDir: string, sourceMap: Map<string, string>): InstalledMeta[] {
    if (!fs.existsSync(installDir)) return [];
    const out: InstalledMeta[] = [];

    for (const entry of fs.readdirSync(installDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('ks-')) continue;
      const pkgPath  = path.join(installDir, entry.name);
      const skillMd  = path.join(pkgPath, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;

      const fm               = parseFrontmatter(skillMd);
      const installedUpdated = String(fm.updated ?? '');
      const sourceUpdated    = sourceMap.get(entry.name) ?? '';
      out.push({
        name:             entry.name,
        installPath:      pkgPath,
        installedUpdated,
        sourceUpdated,
        isOutdated: !!sourceUpdated && !!installedUpdated && sourceUpdated > installedUpdated,
      });
    }
    return out;
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
