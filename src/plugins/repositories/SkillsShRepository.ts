import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { ApmPackage } from '../../models/package.model';
import { ApmSource } from '../../models/config.model';
import { PackageType, inferGroup } from '../../models/provider.model';
import { IRepository } from './IRepository';
import { parseFrontmatter } from '../../utils/frontmatter';

const STALE_MS = 24 * 60 * 60 * 1000; // 24 h

export class SkillsShRepository implements IRepository {
  readonly type = 'skills-sh';

  list(source: ApmSource, cacheDir: string, _projectRoot: string): ApmPackage[] {
    const repoDir = this.repoDir(source, cacheDir);
    if (!fs.existsSync(repoDir)) this.clone(source, repoDir);
    return this.discover(source, repoDir, cacheDir);
  }

  getLocalPath(pkg: ApmPackage, source: ApmSource, cacheDir: string, _projectRoot: string): string {
    const repoDir = this.repoDir(source, cacheDir);
    if (!fs.existsSync(repoDir)) this.clone(source, repoDir);
    const vDir = pkg.sourceRef ?? path.join(this.vSkillsRoot(source, cacheDir), pkg.name.split('/').pop()!);
    if (!fs.existsSync(vDir)) {
      this.discover(source, repoDir, cacheDir);
    }
    return vDir;
  }

  refresh(source: ApmSource, cacheDir: string): void {
    const repoDir = this.repoDir(source, cacheDir);
    if (!fs.existsSync(repoDir)) { this.clone(source, repoDir); return; }
    try {
      execSync(`git -C "${repoDir}" pull --ff-only --quiet`, { stdio: 'pipe' });
      fs.writeFileSync(path.join(repoDir, '.apm-last-refresh'), new Date().toISOString());
    } catch (err) {
      throw new Error(`Failed to refresh skills-sh source "${source.name}": ${String(err)}`);
    }
  }

  isStale(source: ApmSource, cacheDir: string): boolean {
    const marker = path.join(this.repoDir(source, cacheDir), '.apm-last-refresh');
    if (!fs.existsSync(marker)) return true;
    return Date.now() - new Date(fs.readFileSync(marker, 'utf-8').trim()).getTime() > STALE_MS;
  }

  // ── private ─────────────────────────────────────────────────────────────────

  private discover(source: ApmSource, repoDir: string, cacheDir: string): ApmPackage[] {
    const manifestPath = path.join(repoDir, 'skills.json');
    if (fs.existsSync(manifestPath)) {
      return this.fromManifest(source, repoDir, manifestPath, cacheDir);
    }

    const scanDir = source.skillsPath
      ? path.join(repoDir, source.skillsPath)
      : repoDir;

    if (!fs.existsSync(scanDir)) return [];

    const entries  = fs.readdirSync(scanDir, { withFileTypes: true });
    const hasDirs  = entries.some(e => e.isDirectory());
    const packages: ApmPackage[] = [];

    if (hasDirs) {
      for (const e of entries.filter(e => e.isDirectory())) {
        const dirPath = path.join(scanDir, e.name);
        const meta    = this.readMeta(dirPath, e.name);
        packages.push(this.makePackage(source, e.name, dirPath, meta));
      }
    }

    for (const e of entries.filter(e => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')) {
      const skillName = path.basename(e.name, '.md');
      const mdFile    = path.join(scanDir, e.name);
      const vDir      = this.virtualise(skillName, mdFile, source, cacheDir);
      const meta      = this.readMeta(vDir, skillName);
      packages.push(this.makePackage(source, skillName, vDir, meta));
    }

    return packages.sort((a, b) => a.name.localeCompare(b.name));
  }

  private fromManifest(
    source: ApmSource,
    repoDir: string,
    manifestPath: string,
    cacheDir: string,
  ): ApmPackage[] {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as {
        skills?: Array<{ name: string; file?: string; description?: string; updated?: string }>;
      };
      return (manifest.skills ?? []).map(entry => {
        const mdFile = path.join(repoDir, entry.file ?? `${entry.name}.md`);
        const vDir   = this.virtualise(entry.name, mdFile, source, cacheDir);
        return this.makePackage(source, entry.name, vDir, {
          description: entry.description ?? '',
          updated:     entry.updated     ?? '',
        });
      });
    } catch {
      return [];
    }
  }

  private virtualise(skillName: string, mdFile: string, source: ApmSource, cacheDir: string): string {
    const vDir     = path.join(this.vSkillsRoot(source, cacheDir), skillName);
    const destFile = path.join(vDir, `${skillName}.md`);
    fs.mkdirSync(vDir, { recursive: true });
    if (!fs.existsSync(destFile) || this.isNewerThan(mdFile, destFile)) {
      fs.copyFileSync(mdFile, destFile);
    }
    return vDir;
  }

  private vSkillsRoot(source: ApmSource, cacheDir: string): string {
    return path.join(this.repoDir(source, cacheDir), '_vskills');
  }

  private readMeta(dirOrFile: string, name: string): { description: string; updated: string } {
    const candidates = fs.existsSync(dirOrFile) && fs.statSync(dirOrFile).isDirectory()
      ? fs.readdirSync(dirOrFile).filter(f => f.endsWith('.md')).map(f => path.join(dirOrFile, f))
      : [dirOrFile];
    for (const candidate of candidates) {
      try {
        const fm = parseFrontmatter(candidate);
        return {
          description: String((fm as Record<string, unknown>).description ?? ''),
          updated:     String((fm as Record<string, unknown>).updated     ?? ''),
        };
      } catch { /* skip */ }
    }
    return { description: name, updated: '' };
  }

  private makePackage(
    source: ApmSource,
    rawName: string,
    localPath: string,
    meta: { description: string; updated: string },
  ): ApmPackage {
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

  private isNewerThan(src: string, dest: string): boolean {
    try {
      return fs.statSync(src).mtimeMs > fs.statSync(dest).mtimeMs;
    } catch {
      return true;
    }
  }

  private repoDir(source: ApmSource, cacheDir: string): string {
    return path.join(cacheDir || path.join(os.homedir(), '.apm', 'cache'), source.name);
  }

  private clone(source: ApmSource, repoDir: string): void {
    if (!source.url) throw new Error(`skills-sh source "${source.name}" has no url configured.`);
    try { execSync('git --version', { stdio: 'pipe' }); } catch {
      throw new Error('git is required for skills-sh sources but was not found on PATH.');
    }
    fs.mkdirSync(path.dirname(repoDir), { recursive: true });
    const refFlag = source.ref ? `--branch "${source.ref}"` : '';
    try {
      execSync(`git clone --depth=1 ${refFlag} "${source.url}" "${repoDir}"`, { stdio: 'pipe' });
      fs.writeFileSync(path.join(repoDir, '.apm-last-refresh'), new Date().toISOString());
    } catch (err) {
      if (fs.existsSync(repoDir)) fs.rmSync(repoDir, { recursive: true, force: true });
      throw new Error(
        `Failed to clone "${source.url}": ${String(err)}\n` +
        'Ensure git is on your PATH and the repository URL is accessible.',
      );
    }
  }
}
