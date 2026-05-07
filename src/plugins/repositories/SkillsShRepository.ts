import { access, readFile, writeFile, mkdir, copyFile, readdir, stat, rm } from 'fs/promises';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { IApmPackage } from '../../models/IApmPackage';
import { IApmSource } from '../../models/IApmSource';
import { PackageType } from '../../models/PackageType';
import { inferGroup } from '../../models/Groups';
import { IComponentScanner } from '../../models/IComponentScanner';
import { IRepository } from '../../models/IRepository';
import { parseFrontmatterAsync } from '../../utils/frontmatter';

const execFileAsync = promisify(execFile);
const STALE_MS = 24 * 60 * 60 * 1000;

export class SkillsShRepository implements IRepository {
  readonly type: string;

  constructor() {
    this.type = 'skills-sh';
  }

  async list(source: IApmSource, cacheDir: string, _projectRoot: string, _component?: IComponentScanner): Promise<IApmPackage[]> {
    const repoDir = this.repoDir(source, cacheDir);
    if (!(await this.exists(repoDir))) await this.clone(source, repoDir);
    return this.discover(source, repoDir, cacheDir);
  }

  async getLocalPath(pkg: IApmPackage, source: IApmSource, cacheDir: string, _projectRoot: string): Promise<string> {
    const repoDir = this.repoDir(source, cacheDir);
    if (!(await this.exists(repoDir))) await this.clone(source, repoDir);
    const vDir = pkg.sourceRef ?? path.join(this.vSkillsRoot(source, cacheDir), pkg.name.split('/').pop()!);
    if (!(await this.exists(vDir))) {
      await this.discover(source, repoDir, cacheDir);
    }
    return vDir;
  }

  async refresh(source: IApmSource, cacheDir: string): Promise<void> {
    const repoDir = this.repoDir(source, cacheDir);
    if (!(await this.exists(repoDir))) { await this.clone(source, repoDir); return; }
    try {
      await execFileAsync('git', ['-C', repoDir, 'pull', '--ff-only', '--quiet']);
      await writeFile(path.join(repoDir, '.apm-last-refresh'), new Date().toISOString());
    } catch (err) {
      throw new Error(`Failed to refresh skills-sh source "${source.name}": ${String(err)}`);
    }
  }

  async isStale(source: IApmSource, cacheDir: string): Promise<boolean> {
    const marker = path.join(this.repoDir(source, cacheDir), '.apm-last-refresh');
    try {
      const content = await readFile(marker, 'utf-8');
      return Date.now() - new Date(content.trim()).getTime() > STALE_MS;
    } catch {
      return true;
    }
  }

  // ── private ─────────────────────────────────────────────────────────────────

  private async discover(source: IApmSource, repoDir: string, cacheDir: string): Promise<IApmPackage[]> {
    const manifestPath = path.join(repoDir, 'skills.json');
    if (await this.exists(manifestPath)) {
      return this.fromManifest(source, repoDir, manifestPath, cacheDir);
    }

    const scanDir = source.skillsPath ? path.join(repoDir, source.skillsPath) : repoDir;
    if (!(await this.exists(scanDir))) return [];

    const entries  = await readdir(scanDir, { withFileTypes: true });
    const hasDirs  = entries.some(e => e.isDirectory());
    const packages: IApmPackage[] = [];

    if (hasDirs) {
      for (const e of entries.filter(e => e.isDirectory())) {
        const dirPath = path.join(scanDir, e.name);
        const meta    = await this.readMeta(dirPath, e.name);
        packages.push(this.makePackage(source, e.name, dirPath, meta));
      }
    }

    for (const e of entries.filter(e => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')) {
      const skillName = path.basename(e.name, '.md');
      const mdFile    = path.join(scanDir, e.name);
      const vDir      = await this.virtualise(skillName, mdFile, source, cacheDir);
      const meta      = await this.readMeta(vDir, skillName);
      packages.push(this.makePackage(source, skillName, vDir, meta));
    }

    return packages.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async fromManifest(
    source: IApmSource,
    repoDir: string,
    manifestPath: string,
    cacheDir: string,
  ): Promise<IApmPackage[]> {
    try {
      const text     = await readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(text) as {
        skills?: Array<{ name: string; file?: string; description?: string; updated?: string }>;
      };
      return Promise.all(
        (manifest.skills ?? []).map(async entry => {
          const mdFile = path.join(repoDir, entry.file ?? `${entry.name}.md`);
          const vDir   = await this.virtualise(entry.name, mdFile, source, cacheDir);
          return this.makePackage(source, entry.name, vDir, {
            description: entry.description ?? '',
            updated:     entry.updated     ?? '',
          });
        }),
      );
    } catch {
      return [];
    }
  }

  private async virtualise(skillName: string, mdFile: string, source: IApmSource, cacheDir: string): Promise<string> {
    const vDir     = path.join(this.vSkillsRoot(source, cacheDir), skillName);
    const destFile = path.join(vDir, `${skillName}.md`);
    await mkdir(vDir, { recursive: true });
    if (!(await this.exists(destFile)) || await this.isNewerThan(mdFile, destFile)) {
      await copyFile(mdFile, destFile);
    }
    return vDir;
  }

  private vSkillsRoot(source: IApmSource, cacheDir: string): string {
    return path.join(this.repoDir(source, cacheDir), '_vskills');
  }

  private async readMeta(dirOrFile: string, name: string): Promise<{ description: string; updated: string }> {
    let candidates: string[];
    try {
      const s = await stat(dirOrFile);
      if (s.isDirectory()) {
        const files = await readdir(dirOrFile);
        candidates = files.filter(f => f.endsWith('.md')).map(f => path.join(dirOrFile, f));
      } else {
        candidates = [dirOrFile];
      }
    } catch {
      return { description: name, updated: '' };
    }

    for (const candidate of candidates) {
      try {
        const fm = await parseFrontmatterAsync(candidate);
        return {
          description: String((fm as Record<string, unknown>).description ?? ''),
          updated:     String((fm as Record<string, unknown>).updated     ?? ''),
        };
      } catch { /* skip */ }
    }
    return { description: name, updated: '' };
  }

  private makePackage(
    source: IApmSource,
    rawName: string,
    localPath: string,
    meta: { description: string; updated: string },
  ): IApmPackage {
    const name = source.namespace ? `${source.namespace}/${rawName}` : rawName;
    return {
      name,
      path:        rawName,
      type:        PackageType.SKILL,
      description: meta.description,
      group:       inferGroup(rawName),
      created:     '',
      updated:     meta.updated,
      sourceRef:   localPath,
      localPath,
    };
  }

  private async isNewerThan(src: string, dest: string): Promise<boolean> {
    try {
      const [srcStat, destStat] = await Promise.all([stat(src), stat(dest)]);
      return srcStat.mtimeMs > destStat.mtimeMs;
    } catch {
      return true;
    }
  }

  private repoDir(source: IApmSource, cacheDir: string): string {
    return path.join(cacheDir || path.join(os.homedir(), '.apm', 'cache'), source.name);
  }

  private async clone(source: IApmSource, repoDir: string): Promise<void> {
    if (!source.url) throw new Error(`skills-sh source "${source.name}" has no url configured.`);
    try { await execFileAsync('git', ['--version']); } catch {
      throw new Error('git is required for skills-sh sources but was not found on PATH.');
    }
    await mkdir(path.dirname(repoDir), { recursive: true });
    const args = ['clone', '--depth=1'];
    if (source.ref) args.push('--branch', source.ref);
    args.push(source.url, repoDir);
    try {
      await execFileAsync('git', args);
      await writeFile(path.join(repoDir, '.apm-last-refresh'), new Date().toISOString());
    } catch (err) {
      try { await rm(repoDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
      throw new Error(
        `Failed to clone "${source.url}": ${String(err)}\n` +
        'Ensure git is on your PATH and the repository URL is accessible.',
      );
    }
  }

  private async exists(p: string): Promise<boolean> {
    try { await access(p); return true; } catch { return false; }
  }
}
