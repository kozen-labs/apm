import { access, readdir, rm, copyFile } from 'fs/promises';
import type { Dirent } from 'fs';
import path from 'path';
import { IApmPackage } from '../../models/IApmPackage';
import { IInstalledMeta } from '../../models/IInstalledMeta';
import { PackageType } from '../../models/PackageType';
import { parseFrontmatterAsync } from '../../utils/frontmatter';
import { BaseComponent } from './BaseComponent';

/**
 * Agent — component for agent .md definition files.
 *
 * An agent is a markdown file with YAML frontmatter (description, created, updated)
 * that defines a sub-agent persona or workflow.
 */
export class Agent extends BaseComponent {
  readonly type:          PackageType;
  readonly installSubdir: string;

  constructor(dependency?: ConstructorParameters<typeof BaseComponent>[0]) {
    super(dependency);
    this.type          = PackageType.AGENT;
    this.installSubdir = 'agents';
  }

  async matchEntry(entry: Dirent, _parentDir: string): Promise<boolean> {
    return !entry.isDirectory() && entry.name.endsWith('.md') && entry.name !== 'SKILL.md';
  }

  async readMeta(entryPath: string, entryName: string): Promise<Partial<IApmPackage>> {
    const fm       = await parseFrontmatterAsync(entryPath);
    const baseName = entryName.replace(/\.md$/, '');
    return {
      path:        entryName,
      description: String(fm.description ?? '').slice(0, 200),
      created:     String(fm.created  ?? ''),
      updated:     String(fm.updated  ?? ''),
      version:     String(fm.version  ?? ''),
      _baseName:   baseName,
    } as Partial<IApmPackage> & { _baseName: string };
  }

  async copyTo(srcPath: string, _bareName: string, installDir: string): Promise<void> {
    const dst = path.join(installDir, path.basename(srcPath));
    if (this.samePath(dst, srcPath)) return;
    await copyFile(srcPath, dst);
  }

  async removeFrom(bareName: string, installDir: string): Promise<void> {
    const p = path.join(installDir, `${bareName}.md`);
    try { await access(p); } catch { throw Object.assign(new Error(`Not found: ${p}`), { code: 'ENOENT' }); }
    await rm(p, { force: true });
  }

  async listFrom(installDir: string, sourceMap: Map<string, string>): Promise<IInstalledMeta[]> {
    let files: string[];
    try {
      files = await readdir(installDir);
    } catch {
      return [];
    }

    const results = await Promise.all(
      files
        .filter(f => f.endsWith('.md') && f !== 'SKILL.md')
        .map(async f => {
          const agentPath        = path.join(installDir, f);
          const fm               = await parseFrontmatterAsync(agentPath);
          const name             = f.replace(/\.md$/, '');
          const installedUpdated = String(fm.updated ?? '');
          const sourceUpdated    = sourceMap.get(name) ?? '';
          return {
            name,
            installPath:      agentPath,
            installedUpdated,
            sourceUpdated,
            isOutdated: !!sourceUpdated && !!installedUpdated && sourceUpdated > installedUpdated,
          } satisfies IInstalledMeta;
        }),
    );
    return results;
  }

  private samePath(a: string, b: string): boolean {
    try { return path.resolve(a) === path.resolve(b); } catch { return false; }
  }
}
