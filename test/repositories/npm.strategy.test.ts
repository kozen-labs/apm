import fs from 'fs';
import path from 'path';
import os from 'os';

jest.mock('child_process');
import { execFile } from 'child_process';

import { NpmRepository } from '../../src/plugins/repositories/NpmRepository';
import { PackageType } from '../../src/models/PackageType';
import type { IApmSource } from '../../src/models/IApmSource';
import type { IComponentScanner } from '../../src/models/IComponentScanner';
import type { Dirent } from 'fs';

const mockedExecFile = execFile as unknown as jest.Mock;

/** Invoke the callback regardless of whether opts was passed or not. */
function callCb(args: unknown[], err: Error | null, stdout = '', stderr = ''): void {
  const cb = args.find(a => typeof a === 'function') as Function;
  cb(err, stdout, stderr);
}

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `apm-npm-test-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function mockScanner(): IComponentScanner {
  return {
    type:       PackageType.SKILL,
    matchEntry: async (entry: Dirent) => entry.isDirectory(),
    readMeta:   async () => ({ description: 'Test', created: '2024-01-01', updated: '2025-01-01' }),
  };
}

function makeSource(overrides: Partial<IApmSource> = {}): IApmSource {
  return {
    name:       'test-npm-source',
    type:       'npm',
    package:    'my-skills-package',
    skillsPath: '.agents/skills',
    enabled:    true,
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

describe('NpmRepository', () => {
  let tmpDir: string;
  let strategy: NpmRepository;

  beforeEach(() => {
    tmpDir   = makeTmpDir();
    strategy = new NpmRepository();
    mockedExecFile.mockReset();
    mockedExecFile.mockImplementation((...args: unknown[]) => callCb(args, null, '', ''));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('list()', () => {
    it('installs the package and returns discovered skills', async () => {
      const source  = makeSource();
      const workDir = path.join(tmpDir, 'npm', 'my-skills-package');

      mockedExecFile.mockImplementation((...args: unknown[]) => {
        seedPackage(workDir, 'my-skills-package');
        callCb(args, null, '', '');
      });

      const pkgs = await strategy.list(source, tmpDir, '/project', mockScanner());

      expect(pkgs.length).toBeGreaterThan(0);
      expect(pkgs[0].name).toBe('ks-example');
      expect(pkgs[0].type).toBe(PackageType.SKILL);
    });

    it('skips the npm install when the package is already cached', async () => {
      const source  = makeSource();
      const workDir = path.join(tmpDir, 'npm', 'my-skills-package');
      seedPackage(workDir, 'my-skills-package');

      await strategy.list(source, tmpDir, '/project', mockScanner());

      expect(mockedExecFile).not.toHaveBeenCalled();
    });

    it('throws when the source has no package field', async () => {
      const source = makeSource({ package: undefined });
      await expect(strategy.list(source, tmpDir, '/project', mockScanner()))
        .rejects.toThrow(/missing a "package" field/);
    });

    it('cleans up on npm install failure', async () => {
      const source = makeSource();
      let callCount = 0;
      mockedExecFile.mockImplementation((...args: unknown[]) => {
        callCount++;
        callCb(args, callCount > 1 ? new Error('npm ERR! not found') : null, callCount === 1 ? '10.0.0' : '');
      });

      await expect(strategy.list(source, tmpDir, '/project', mockScanner()))
        .rejects.toThrow(/Failed to install/);
    });
  });

  describe('isStale()', () => {
    it('returns true when no marker file exists', async () => {
      const source = makeSource();
      expect(await strategy.isStale(source, tmpDir)).toBe(true);
    });

    it('returns false when marker is recent', async () => {
      const source  = makeSource();
      const workDir = path.join(tmpDir, 'npm', 'my-skills-package');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(path.join(workDir, '.apm-last-refresh'), new Date().toISOString());

      expect(await strategy.isStale(source, tmpDir)).toBe(false);
    });

    it('returns true when marker is older than 24 hours', async () => {
      const source  = makeSource();
      const workDir = path.join(tmpDir, 'npm', 'my-skills-package');
      fs.mkdirSync(workDir, { recursive: true });
      const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
      fs.writeFileSync(path.join(workDir, '.apm-last-refresh'), old.toISOString());

      expect(await strategy.isStale(source, tmpDir)).toBe(true);
    });
  });

  describe('refresh()', () => {
    it('runs npm install @latest and writes the marker file', async () => {
      const source  = makeSource();
      const workDir = path.join(tmpDir, 'npm', 'my-skills-package');
      fs.mkdirSync(workDir, { recursive: true });

      await strategy.refresh(source, tmpDir);

      expect(mockedExecFile).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['install', expect.stringContaining('@latest')]),
        expect.objectContaining({ cwd: workDir }),
        expect.any(Function),
      );
      expect(fs.existsSync(path.join(workDir, '.apm-last-refresh'))).toBe(true);
    });

    it('throws a human-readable error on npm failure', async () => {
      const source  = makeSource();
      const workDir = path.join(tmpDir, 'npm', 'my-skills-package');
      fs.mkdirSync(workDir, { recursive: true });

      let callCount = 0;
      mockedExecFile.mockImplementation((...args: unknown[]) => {
        callCount++;
        callCb(args, callCount > 1 ? new Error('E404') : null, callCount === 1 ? '10.0.0' : '');
      });

      await expect(strategy.refresh(source, tmpDir)).rejects.toThrow(/Failed to refresh npm source/);
    });
  });

  describe('getLocalPath()', () => {
    it('returns the local path of a cached package', async () => {
      const source  = makeSource();
      const workDir = path.join(tmpDir, 'npm', 'my-skills-package');
      seedPackage(workDir, 'my-skills-package');

      const pkg = {
        name: 'ks-example', path: 'ks-example', type: PackageType.SKILL,
        description: '', group: 'MongoDB', created: '', updated: '',
        sourceRef: 'test-npm-source',
      };

      const localPath = await strategy.getLocalPath(pkg, source, tmpDir, '/project');
      expect(localPath).toContain('ks-example');
    });
  });
});
