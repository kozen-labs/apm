import { access, writeFile, mkdir, rm, readFile } from 'fs/promises';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { IApmPackage } from '../../models/IApmPackage';
import { IApmSource } from '../../models/IApmSource';
import { IComponentScanner } from '../../models/IComponentScanner';
import { IRepository } from '../../models/IRepository';
import { LocalRepository } from './LocalRepository';

const execFileAsync = promisify(execFile);
const STALE_MS = 24 * 60 * 60 * 1000;

export class GitHubRepository implements IRepository {
  readonly type: string;
  private readonly localRepo: LocalRepository;

  constructor(dependency?: { localRepo?: LocalRepository }) {
    this.type      = 'github';
    this.localRepo = dependency?.localRepo ?? new LocalRepository();
  }

  async list(source: IApmSource, cacheDir: string, _projectRoot: string, component: IComponentScanner): Promise<IApmPackage[]> {
    const repoDir = this.getRepoDir(source, cacheDir);
    if (!(await this.exists(repoDir))) await this.clone(source, repoDir);
    return this.localRepo.list(this.toCacheSource(source, repoDir), cacheDir, repoDir, component);
  }

  async getLocalPath(pkg: IApmPackage, source: IApmSource, cacheDir: string, _projectRoot: string): Promise<string> {
    const repoDir = this.getRepoDir(source, cacheDir);
    if (!(await this.exists(repoDir))) await this.clone(source, repoDir);
    return this.localRepo.getLocalPath(pkg, this.toCacheSource(source, repoDir), cacheDir, repoDir);
  }

  async refresh(source: IApmSource, cacheDir: string): Promise<void> {
    const repoDir = this.getRepoDir(source, cacheDir);
    if (!(await this.exists(repoDir))) { await this.clone(source, repoDir); return; }
    try {
      await execFileAsync('git', ['-C', repoDir, 'pull', '--ff-only', '--quiet']);
      await writeFile(path.join(repoDir, '.apm-last-refresh'), new Date().toISOString());
    } catch (err) {
      throw new Error(
        `Failed to refresh GitHub source "${source.name}" (${source.url}): ${String(err)}`,
      );
    }
  }

  async isStale(source: IApmSource, cacheDir: string): Promise<boolean> {
    const markerFile = path.join(this.getRepoDir(source, cacheDir), '.apm-last-refresh');
    try {
      const content = await readFile(markerFile, 'utf-8');
      return Date.now() - new Date(content.trim()).getTime() > STALE_MS;
    } catch {
      return true;
    }
  }

  // ── private ──────────────────────────────────────────────────────────────

  private getRepoDir(source: IApmSource, cacheDir: string): string {
    return path.join(cacheDir || path.join(os.homedir(), 'apm.cache'), source.name);
  }

  private async clone(source: IApmSource, repoDir: string): Promise<void> {
    if (!source.url) throw new Error(`GitHub source "${source.name}" has no url configured.`);
    await this.assertGit();
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
        'Ensure git is on your PATH and the URL is accessible.',
      );
    }
  }

  private async assertGit(): Promise<void> {
    try {
      await execFileAsync('git', ['--version']);
    } catch {
      throw new Error(
        'git is required for GitHub repository sources but was not found on PATH.\n' +
        'Install git from https://git-scm.com/ and retry.',
      );
    }
  }

  private toCacheSource(source: IApmSource, repoDir: string): IApmSource {
    return { ...source, type: 'local', path: repoDir };
  }

  private async exists(p: string): Promise<boolean> {
    try { await access(p); return true; } catch { return false; }
  }
}
