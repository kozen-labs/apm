import fs from 'fs';
import path from 'path';
import { ApmPackage, InstalledMeta } from '../../models/package.model';
import { PackageType } from '../../models/provider.model';
import { parseFrontmatter } from '../../utils/frontmatter';
import { BaseComponentPlugin } from './BaseComponentPlugin';

/**
 * AgentPlugin — component plugin for agent .md definition files.
 *
 * An agent is a markdown file with YAML frontmatter (description, created, updated)
 * that defines a sub-agent persona or workflow. It is installed as a single file,
 * not as a directory.
 *
 * Source layout:
 *   .agents/agents/
 *     my-agent.md       ← one file per agent
 *
 * Default install layout:
 *   <installDir>/my-agent.md  (file copy)
 */
export class AgentPlugin extends BaseComponentPlugin {
  readonly type          = PackageType.AGENT;
  readonly installSubdir = 'agents';

  matchEntry(entry: fs.Dirent, _parentDir: string): boolean {
    return !entry.isDirectory() && entry.name.endsWith('.md') && entry.name !== 'SKILL.md';
  }

  readMeta(entryPath: string, entryName: string): Partial<ApmPackage> {
    const fm       = parseFrontmatter(entryPath);
    const baseName = entryName.replace(/\.md$/, '');
    return {
      path:        entryName,
      description: String(fm.description ?? '').slice(0, 200),
      created:     String(fm.created  ?? ''),
      updated:     String(fm.updated  ?? ''),
      version:     String(fm.version  ?? ''),
      // name is overridden by the caller (namespace + baseName)
      _baseName:   baseName,
    } as Partial<ApmPackage> & { _baseName: string };
  }

  copyTo(srcPath: string, _bareName: string, installDir: string): void {
    const dst = path.join(installDir, path.basename(srcPath));
    if (this.samePath(dst, srcPath)) return;
    fs.copyFileSync(srcPath, dst);
  }

  removeFrom(bareName: string, installDir: string): void {
    const p = path.join(installDir, `${bareName}.md`);
    if (!fs.existsSync(p)) {
      throw Object.assign(new Error(`Not found: ${p}`), { code: 'ENOENT' });
    }
    fs.rmSync(p, { force: true });
  }

  listFrom(installDir: string, sourceMap: Map<string, string>): InstalledMeta[] {
    if (!fs.existsSync(installDir)) return [];
    const out: InstalledMeta[] = [];

    for (const f of fs.readdirSync(installDir)) {
      if (!f.endsWith('.md') || f === 'SKILL.md') continue;
      const agentPath        = path.join(installDir, f);
      const fm               = parseFrontmatter(agentPath);
      const name             = f.replace(/\.md$/, '');
      const installedUpdated = String(fm.updated ?? '');
      const sourceUpdated    = sourceMap.get(name) ?? '';
      out.push({
        name,
        installPath:      agentPath,
        installedUpdated,
        sourceUpdated,
        isOutdated: !!sourceUpdated && !!installedUpdated && sourceUpdated > installedUpdated,
      });
    }
    return out;
  }

  private samePath(a: string, b: string): boolean {
    try { return path.resolve(a) === path.resolve(b); } catch { return false; }
  }
}
