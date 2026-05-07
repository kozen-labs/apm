import { access, mkdir, writeFile, readFile, rm } from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { IApmPackage } from '../../models/IApmPackage';
import { IApmSource } from '../../models/IApmSource';
import { IComponentScanner } from '../../models/IComponentScanner';
import { IRepository } from '../../models/IRepository';
import { LocalRepository } from './LocalRepository';

const execFileAsync = promisify(execFile);

export class NpmRepository implements IRepository {
  readonly type: string;
  private readonly localRepo: LocalRepository;

  constructor(dependency?: { localRepo?: LocalRepository }) {
    this.type      = 'npm';
    this.localRepo = dependency?.localRepo ?? new LocalRepository();
  }

  async list(source: IApmSource, cacheDir: string, _projectRoot: string, component: IComponentScanner): Promise<IApmPackage[]> {
    const pkgDir = await this.ensureInstalled(source, cacheDir);
    return this.localRepo.list(this.toLocalSource(source, pkgDir), cacheDir, pkgDir, component);
  }

  async getLocalPath(pkg: IApmPackage, source: IApmSource, cacheDir: string, _projectRoot: string): Promise<string> {
    const pkgDir = await this.ensureInstalled(source, cacheDir);
    return this.localRepo.getLocalPath(pkg, this.toLocalSource(source, pkgDir), cacheDir, pkgDir);
  }

  async refresh(source: IApmSource, cacheDir: string): Promise<void> {
    await this.assertNpm();
    const pkg     = this.requirePackage(source);
    const workDir = this.getWorkDir(source, cacheDir);
    await mkdir(workDir, { recursive: true });
    await this.ensurePackageJson(workDir);
    try {
      await execFileAsync('npm', ['install', `${pkg}@latest`, '--save', '--no-audit', '--no-fund'], { cwd: workDir });
      await writeFile(path.join(workDir, '.apm-last-refresh'), new Date().toISOString());
    } catch (err) {
      throw new Error(`Failed to refresh npm source "${source.name}" (${pkg}): ${String(err)}`);
    }
  }

  async isStale(source: IApmSource, cacheDir: string): Promise<boolean> {
    const markerFile = path.join(this.getWorkDir(source, cacheDir), '.apm-last-refresh');
    try {
      const content = await readFile(markerFile, 'utf-8');
      return Date.now() - new Date(content.trim()).getTime() > 24 * 60 * 60 * 1000;
    } catch {
      return true;
    }
  }

  // ── private ──────────────────────────────────────────────────────────────

  private async ensureInstalled(source: IApmSource, cacheDir: string): Promise<string> {
    const pkg     = this.requirePackage(source);
    const workDir = this.getWorkDir(source, cacheDir);
    const pkgDir  = path.join(workDir, 'node_modules', pkg);
    if (await this.exists(pkgDir)) return pkgDir;

    await this.assertNpm();
    await mkdir(workDir, { recursive: true });
    await this.ensurePackageJson(workDir);
    try {
      await execFileAsync('npm', ['install', pkg, '--save', '--no-audit', '--no-fund'], { cwd: workDir });
      await writeFile(path.join(workDir, '.apm-last-refresh'), new Date().toISOString());
    } catch (err) {
      try { await rm(pkgDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
      throw new Error(
        `Failed to install npm package "${pkg}": ${String(err)}\n` +
        'Ensure npm is on your PATH and the package name is correct.',
      );
    }
    return pkgDir;
  }

  private getWorkDir(source: IApmSource, cacheDir: string): string {
    const safeName = (source.package ?? source.name).replace(/[@/]/g, '_');
    return path.join(cacheDir, 'npm', safeName);
  }

  private async ensurePackageJson(workDir: string): Promise<void> {
    const pkgJson = path.join(workDir, 'package.json');
    if (await this.exists(pkgJson)) return;
    await writeFile(pkgJson, JSON.stringify({ name: 'apm-cache', private: true }), 'utf-8');
  }

  private requirePackage(source: IApmSource): string {
    if (!source.package) {
      throw new Error(
        `npm source "${source.name}" is missing a "package" field in apm.pack.json.`,
      );
    }
    if (!/^[@a-zA-Z0-9/_.-]+$/.test(source.package)) {
      throw new Error(
        `npm source "${source.name}" has an invalid package name: "${source.package}". ` +
        'Only letters, numbers, @, /, _, -, and . are allowed.',
      );
    }
    return source.package;
  }

  private async assertNpm(): Promise<void> {
    try {
      await execFileAsync('npm', ['--version']);
    } catch {
      throw new Error('npm is required for npm repository sources but was not found on PATH.');
    }
  }

  private toLocalSource(source: IApmSource, pkgDir: string): IApmSource {
    return { ...source, type: 'local', path: pkgDir };
  }

  private async exists(p: string): Promise<boolean> {
    try { await access(p); return true; } catch { return false; }
  }
}
