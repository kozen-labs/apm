import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { ApmPackage } from '../../models/package.model';
import { ApmSource } from '../../models/config.model';
import { IComponentScanner } from '../../models/component.model';
import { IRepository } from './IRepository';
import { LocalRepository } from './LocalRepository';

export class NpmRepository implements IRepository {
  readonly type = 'npm';

  private local = new LocalRepository();

  list(source: ApmSource, cacheDir: string, _projectRoot: string, component: IComponentScanner): ApmPackage[] {
    const pkgDir = this.ensureInstalled(source, cacheDir);
    return this.local.list(this.toLocalSource(source, pkgDir), cacheDir, pkgDir, component);
  }

  getLocalPath(pkg: ApmPackage, source: ApmSource, cacheDir: string, _projectRoot: string): string {
    const pkgDir = this.ensureInstalled(source, cacheDir);
    return this.local.getLocalPath(pkg, this.toLocalSource(source, pkgDir), cacheDir, pkgDir);
  }

  refresh(source: ApmSource, cacheDir: string): void {
    this.assertNpm();
    const pkg     = this.requirePackage(source);
    const workDir = this.getWorkDir(source, cacheDir);
    fs.mkdirSync(workDir, { recursive: true });
    this.ensurePackageJson(workDir);
    try {
      execSync(`npm install "${pkg}@latest" --save --no-audit --no-fund`, {
        cwd: workDir, stdio: 'pipe',
      });
      fs.writeFileSync(path.join(workDir, '.apm-last-refresh'), new Date().toISOString());
    } catch (err) {
      throw new Error(`Failed to refresh npm source "${source.name}" (${pkg}): ${String(err)}`);
    }
  }

  isStale(source: ApmSource, cacheDir: string): boolean {
    const markerFile = path.join(this.getWorkDir(source, cacheDir), '.apm-last-refresh');
    if (!fs.existsSync(markerFile)) return true;
    const lastRefresh = new Date(fs.readFileSync(markerFile, 'utf-8').trim()).getTime();
    return Date.now() - lastRefresh > 24 * 60 * 60 * 1000;
  }

  // ── private ──────────────────────────────────────────────────────────────

  private ensureInstalled(source: ApmSource, cacheDir: string): string {
    const pkg     = this.requirePackage(source);
    const workDir = this.getWorkDir(source, cacheDir);
    const pkgDir  = path.join(workDir, 'node_modules', pkg);
    if (!fs.existsSync(pkgDir)) {
      this.assertNpm();
      fs.mkdirSync(workDir, { recursive: true });
      this.ensurePackageJson(workDir);
      try {
        execSync(`npm install "${pkg}" --save --no-audit --no-fund`, {
          cwd: workDir, stdio: 'pipe',
        });
        fs.writeFileSync(path.join(workDir, '.apm-last-refresh'), new Date().toISOString());
      } catch (err) {
        if (fs.existsSync(pkgDir)) fs.rmSync(pkgDir, { recursive: true, force: true });
        throw new Error(
          `Failed to install npm package "${pkg}": ${String(err)}\n` +
          'Ensure npm is on your PATH and the package name is correct.',
        );
      }
    }
    return pkgDir;
  }

  private getWorkDir(source: ApmSource, cacheDir: string): string {
    const safeName = (source.package ?? source.name).replace(/[@/]/g, '_');
    return path.join(cacheDir, 'npm', safeName);
  }

  private ensurePackageJson(workDir: string): void {
    const pkgJson = path.join(workDir, 'package.json');
    if (!fs.existsSync(pkgJson)) {
      fs.writeFileSync(pkgJson, JSON.stringify({ name: 'apm-cache', private: true }), 'utf-8');
    }
  }

  private requirePackage(source: ApmSource): string {
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

  private assertNpm(): void {
    try {
      execSync('npm --version', { stdio: 'pipe' });
    } catch {
      throw new Error('npm is required for npm repository sources but was not found on PATH.');
    }
  }

  private toLocalSource(source: ApmSource, pkgDir: string): ApmSource {
    return { ...source, type: 'local', path: pkgDir };
  }
}
