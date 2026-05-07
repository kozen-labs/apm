import { access, readdir, rm, mkdir, copyFile } from 'fs/promises';
import type { Dirent } from 'fs';
import path from 'path';
import { IApmPackage } from '../../models/IApmPackage';
import { IInstalledMeta } from '../../models/IInstalledMeta';
import { PackageType } from '../../models/PackageType';
import { parseFrontmatterAsync } from '../../utils/frontmatter';
import { BaseComponent } from './BaseComponent';

/**
 * Skill — component for ks-* skill directories.
 *
 * A skill is a directory whose name begins with 'ks-' and that contains
 * a SKILL.md file with YAML frontmatter (description, created, updated).
 */
export class Skill extends BaseComponent {
  readonly type:          PackageType;
  readonly installSubdir: string;

  constructor(dependency?: ConstructorParameters<typeof BaseComponent>[0]) {
    super(dependency);
    this.type          = PackageType.SKILL;
    this.installSubdir = 'skills';
  }

  async matchEntry(entry: Dirent, parentDir: string): Promise<boolean> {
    if (!entry.isDirectory()) return false;
    if (!entry.name.startsWith('ks-')) return false;
    try { await access(path.join(parentDir, entry.name, 'SKILL.md')); return true; } catch { return false; }
  }

  async readMeta(entryPath: string, entryName: string): Promise<Partial<IApmPackage>> {
    const fm = await parseFrontmatterAsync(path.join(entryPath, 'SKILL.md'));
    return {
      path:        entryName,
      description: String(fm.description ?? ''),
      created:     String(fm.created  ?? ''),
      updated:     String(fm.updated  ?? ''),
      version:     String(fm.version  ?? '1.0.0'),
    };
  }

  async copyTo(srcPath: string, bareName: string, installDir: string): Promise<void> {
    const dst = path.join(installDir, bareName);
    if (this.samePath(dst, srcPath)) return;
    try { await rm(dst, { recursive: true, force: true }); } catch { /* ignore */ }
    await this.copyDir(srcPath, dst);
  }

  async removeFrom(bareName: string, installDir: string): Promise<void> {
    const p = path.join(installDir, bareName);
    try {
      await access(p);
    } catch {
      throw Object.assign(new Error(`Not found: ${p}`), { code: 'ENOENT' });
    }
    await rm(p, { recursive: true, force: true });
  }

  async listFrom(installDir: string, sourceMap: Map<string, string>): Promise<IInstalledMeta[]> {
    let entries: Dirent[];
    try {
      entries = await readdir(installDir, { withFileTypes: true });
    } catch {
      return [];
    }

    const results = await Promise.all(
      entries
        .filter(e => e.isDirectory() && e.name.startsWith('ks-'))
        .map(async entry => {
          const pkgPath  = path.join(installDir, entry.name);
          const skillMd  = path.join(pkgPath, 'SKILL.md');
          try { await access(skillMd); } catch { return null; }
          const fm               = await parseFrontmatterAsync(skillMd);
          const installedUpdated = String(fm.updated ?? '');
          const sourceUpdated    = sourceMap.get(entry.name) ?? '';
          return {
            name:             entry.name,
            installPath:      pkgPath,
            installedUpdated,
            sourceUpdated,
            isOutdated: !!sourceUpdated && !!installedUpdated && sourceUpdated > installedUpdated,
          } satisfies IInstalledMeta;
        }),
    );
    return results.filter(Boolean) as IInstalledMeta[];
  }

  // ── private ──────────────────────────────────────────────────────────────

  private async copyDir(src: string, dst: string): Promise<void> {
    await mkdir(dst, { recursive: true });
    const entries = await readdir(src, { withFileTypes: true });
    await Promise.all(
      entries.map(entry => {
        const s = path.join(src, entry.name);
        const d = path.join(dst, entry.name);
        return entry.isDirectory() ? this.copyDir(s, d) : copyFile(s, d);
      }),
    );
  }

  private samePath(a: string, b: string): boolean {
    try { return path.resolve(a) === path.resolve(b); } catch { return false; }
  }
}
