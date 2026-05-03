import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { ApmPackage } from '../../models/package.model';
import { ApmSource } from '../../models/config.model';
import { IRepositoryStrategy } from './IRepositoryStrategy';
import { LocalRepositoryStrategy } from './local';

const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * GitHubRepositoryStrategy — clones or updates a GitHub repository to a local
 * cache directory, then delegates package scanning to LocalRepositoryStrategy.
 *
 * Source config:
 *   type: 'github'
 *   url: 'https://github.com/mongodb/agent-skills'
 *   ref: 'main'                  (branch/tag, optional)
 *   skillsPath: '.agents/skills' (path within cloned repo, optional)
 *   agentsPath: '.agents/agents' (optional)
 *   namespace: 'mongodb'         (optional name prefix)
 *   singleResource: true         (if the repo itself is one skill)
 *
 * Cache location: {cacheDir}/{source.name}/
 * Requires: git on PATH.
 */
export class GitHubRepositoryStrategy implements IRepositoryStrategy {
  readonly type = 'github';

  private local = new LocalRepositoryStrategy();

  list(source: ApmSource, cacheDir: string, _projectRoot: string): ApmPackage[] {
    const repoDir = this.getRepoDir(source, cacheDir);
    if (!fs.existsSync(repoDir)) this.clone(source, repoDir);
    return this.local.list(this.toCacheSource(source, repoDir), cacheDir, repoDir);
  }

  getLocalPath(pkg: ApmPackage, source: ApmSource, cacheDir: string, _projectRoot: string): string {
    const repoDir = this.getRepoDir(source, cacheDir);
    if (!fs.existsSync(repoDir)) this.clone(source, repoDir);
    return this.local.getLocalPath(pkg, this.toCacheSource(source, repoDir), cacheDir, repoDir);
  }

  refresh(source: ApmSource, cacheDir: string): void {
    const repoDir = this.getRepoDir(source, cacheDir);
    if (!fs.existsSync(repoDir)) { this.clone(source, repoDir); return; }
    try {
      execSync(`git -C "${repoDir}" pull --ff-only --quiet`, { stdio: 'pipe' });
      fs.writeFileSync(path.join(repoDir, '.apm-last-refresh'), new Date().toISOString());
    } catch (err) {
      throw new Error(
        `Failed to refresh GitHub source "${source.name}" (${source.url}): ${String(err)}`,
      );
    }
  }

  isStale(source: ApmSource, cacheDir: string): boolean {
    const markerFile = path.join(this.getRepoDir(source, cacheDir), '.apm-last-refresh');
    if (!fs.existsSync(markerFile)) return true;
    const lastRefresh = new Date(fs.readFileSync(markerFile, 'utf-8').trim()).getTime();
    return Date.now() - lastRefresh > STALE_MS;
  }

  // ── private ──────────────────────────────────────────────────────────────

  private getRepoDir(source: ApmSource, cacheDir: string): string {
    return path.join(cacheDir || path.join(os.homedir(), 'apm.cache'), source.name);
  }

  private clone(source: ApmSource, repoDir: string): void {
    if (!source.url) throw new Error(`GitHub source "${source.name}" has no url configured.`);
    this.assertGit();
    fs.mkdirSync(path.dirname(repoDir), { recursive: true });
    const refFlag = source.ref ? `--branch "${source.ref}"` : '';
    try {
      execSync(`git clone --depth=1 ${refFlag} "${source.url}" "${repoDir}"`, { stdio: 'pipe' });
      fs.writeFileSync(path.join(repoDir, '.apm-last-refresh'), new Date().toISOString());
    } catch (err) {
      if (fs.existsSync(repoDir)) fs.rmSync(repoDir, { recursive: true, force: true });
      throw new Error(
        `Failed to clone "${source.url}": ${String(err)}\n` +
        'Ensure git is on your PATH and the URL is accessible.',
      );
    }
  }

  private assertGit(): void {
    try {
      execSync('git --version', { stdio: 'pipe' });
    } catch {
      throw new Error(
        'git is required for GitHub repository sources but was not found on PATH.\n' +
        'Install git from https://git-scm.com/ and retry.',
      );
    }
  }

  private toCacheSource(source: ApmSource, repoDir: string): ApmSource {
    return { ...source, type: 'local', path: repoDir };
  }
}
