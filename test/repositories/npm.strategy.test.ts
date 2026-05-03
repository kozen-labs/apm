import fs from 'fs';
import path from 'path';
import os from 'os';

jest.mock('child_process', () => ({ execSync: jest.fn() }));
import { execSync } from 'child_process';

import { NpmRepositoryStrategy } from '../../src/repositories/NpmRepositoryStrategy';
import { PackageType } from '../../src/models/provider.model';
import type { ApmSource } from '../../src/models/config.model';

const mockedExec = execSync as jest.Mock;

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `apm-npm-test-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeSource(overrides: Partial<ApmSource> = {}): ApmSource {
  return {
    name:      'test-npm-source',
    type:      'npm',
    package:   'my-skills-package',
    skillsPath: '.agents/skills',
    enabled:   true,
    ...overrides,
  };
}

function seedPackage(workDir: string, pkgName: string): void {
  const pkgDir = path.join(workDir, 'node_modules', pkgName, '.agents', 'skills', 'ks-example');
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(
    path.join(pkgDir, 'SKILL.md'),
    `---\ndescription: Example\ncreated: 2024-01-01\nupdated: 2025-06-01\n---\n\n# Example\n`,
  );
  const pkg = path.join(workDir, 'package.json');
  if (!fs.existsSync(pkg)) {
    fs.writeFileSync(pkg, JSON.stringify({ name: 'apm-cache', private: true }), 'utf-8');
  }
}

describe('NpmRepositoryStrategy', () => {
  let tmpDir: string;
  let strategy: NpmRepositoryStrategy;

  beforeEach(() => {
    tmpDir   = makeTmpDir();
    strategy = new NpmRepositoryStrategy();
    mockedExec.mockReset();
    mockedExec.mockReturnValue(Buffer.from(''));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('list()', () => {
    it('installs the package and returns discovered skills', () => {
      const source  = makeSource();
      const workDir = path.join(tmpDir, 'npm', 'my-skills-package');

      mockedExec.mockImplementation(() => {
        seedPackage(workDir, 'my-skills-package');
        return Buffer.from('');
      });

      const pkgs = strategy.list(source, tmpDir, '/project');

      expect(pkgs.length).toBeGreaterThan(0);
      expect(pkgs[0].name).toBe('ks-example');
      expect(pkgs[0].type).toBe(PackageType.SKILL);
    });

    it('skips the npm install when the package is already cached', () => {
      const source  = makeSource();
      const workDir = path.join(tmpDir, 'npm', 'my-skills-package');
      seedPackage(workDir, 'my-skills-package');

      strategy.list(source, tmpDir, '/project');

      expect(mockedExec).not.toHaveBeenCalled();
    });

    it('throws when the source has no package field', () => {
      const source = makeSource({ package: undefined });
      expect(() => strategy.list(source, tmpDir, '/project'))
        .toThrow(/missing a "package" field/);
    });

    it('cleans up on npm install failure', () => {
      const source = makeSource();
      // First call is assertNpm() (npm --version) — must succeed.
      // Second call is npm install — must fail.
      mockedExec
        .mockReturnValueOnce(Buffer.from('10.0.0'))
        .mockImplementationOnce(() => { throw new Error('npm ERR! not found'); });

      expect(() => strategy.list(source, tmpDir, '/project')).toThrow(/Failed to install/);
    });
  });

  describe('isStale()', () => {
    it('returns true when no marker file exists', () => {
      const source = makeSource();
      expect(strategy.isStale(source, tmpDir)).toBe(true);
    });

    it('returns false when marker is recent', () => {
      const source  = makeSource();
      const workDir = path.join(tmpDir, 'npm', 'my-skills-package');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(path.join(workDir, '.apm-last-refresh'), new Date().toISOString());

      expect(strategy.isStale(source, tmpDir)).toBe(false);
    });

    it('returns true when marker is older than 24 hours', () => {
      const source  = makeSource();
      const workDir = path.join(tmpDir, 'npm', 'my-skills-package');
      fs.mkdirSync(workDir, { recursive: true });
      const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
      fs.writeFileSync(path.join(workDir, '.apm-last-refresh'), old.toISOString());

      expect(strategy.isStale(source, tmpDir)).toBe(true);
    });
  });

  describe('refresh()', () => {
    it('runs npm install @latest and writes the marker file', () => {
      const source  = makeSource();
      const workDir = path.join(tmpDir, 'npm', 'my-skills-package');
      fs.mkdirSync(workDir, { recursive: true });

      strategy.refresh(source, tmpDir);

      expect(mockedExec).toHaveBeenCalledWith(
        expect.stringContaining('@latest'),
        expect.objectContaining({ cwd: workDir }),
      );
      expect(fs.existsSync(path.join(workDir, '.apm-last-refresh'))).toBe(true);
    });

    it('throws a human-readable error on npm failure', () => {
      const source = makeSource();
      const workDir = path.join(tmpDir, 'npm', 'my-skills-package');
      fs.mkdirSync(workDir, { recursive: true });
      // First call is assertNpm() — must succeed. Second call is npm install — must fail.
      mockedExec
        .mockReturnValueOnce(Buffer.from('10.0.0'))
        .mockImplementationOnce(() => { throw new Error('E404'); });

      expect(() => strategy.refresh(source, tmpDir)).toThrow(/Failed to refresh npm source/);
    });
  });

  describe('getLocalPath()', () => {
    it('returns the local path of a cached package', () => {
      const source  = makeSource();
      const workDir = path.join(tmpDir, 'npm', 'my-skills-package');
      seedPackage(workDir, 'my-skills-package');

      const pkg = {
        name: 'ks-example', path: 'ks-example', type: PackageType.SKILL,
        description: '', group: 'MongoDB', created: '', updated: '',
        sourceRef: 'test-npm-source',
      };

      const localPath = strategy.getLocalPath(pkg, source, tmpDir, '/project');
      expect(localPath).toContain('ks-example');
    });
  });
});
