import fs from 'fs';
import path from 'path';
import os from 'os';
import { Skill } from '../../src/plugins/components/Skill';
import { StandardProvider } from '../../src/plugins/providers/StandardProvider';
import { VscodeProvider } from '../../src/plugins/providers/VscodeProvider';
import { CursorProvider } from '../../src/plugins/providers/CursorProvider';
import { LocalRepository } from '../../src/plugins/repositories/LocalRepository';
import { PackageType, Provider, Scope } from '../../src/models/provider.model';
import type { IIoC } from '@kozen/engine';

function makeSkill(): Skill {
  const localRepo    = new LocalRepository();
  const standardProv = new StandardProvider();
  const vscodeProv   = new VscodeProvider();
  const cursorProv   = new CursorProvider();

  const resolveSync = (key: string): unknown => {
    if (key === `apm:plugin:provider:${Provider.STANDARD}`) return standardProv;
    if (key === `apm:plugin:provider:${Provider.VSCODE}`)   return vscodeProv;
    if (key === `apm:plugin:provider:${Provider.CURSOR}`)   return cursorProv;
    if (key.startsWith('apm:plugin:provider:'))             return standardProv;
    if (key === 'apm:plugin:repository:local')              return localRepo;
    throw new Error(`Test: unresolved IoC key: ${key}`);
  };

  return new Skill({ assistant: { resolveSync } as unknown as IIoC, logger: undefined as any });
}

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `apm-installer-test-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function seedSkill(root: string, name: string): string {
  const skillDir = path.join(root, '.agents', 'skills', name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\ndescription: Test skill\ncreated: 2024-01-01\nupdated: 2025-01-01\nversion: 1.0.0\n---\n\n# ${name}\n`,
  );
  return skillDir;
}

function writeConfig(root: string): void {
  fs.writeFileSync(
    path.join(root, 'apm.pack.json'),
    JSON.stringify({
      schemaVersion: '1.0',
      sources: [{ name: 'local', type: 'local', path: '.', enabled: true }],
      defaultProvider: 'standard',
      defaultScope: 'local',
    }),
  );
}

describe('install / uninstall via Skill', () => {
  let tmpDir: string;
  let plugin: Skill;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    plugin = makeSkill();
    writeConfig(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('install()', () => {
    it('copies a skill directory to the target location', () => {
      seedSkill(tmpDir, 'ks-mongodb-core');
      const target = path.join(tmpDir, 'install-target', 'skills');

      const result = plugin.install({
        projectRoot: tmpDir,
        provider:    Provider.STANDARD,
        scope:       Scope.LOCAL,
        names:       ['ks-mongodb-core'],
        customDir:   target,
      });

      expect(result.succeeded).toContain('ks-mongodb-core');
      expect(result.errors).toHaveLength(0);
      expect(fs.existsSync(path.join(target, 'ks-mongodb-core', 'SKILL.md'))).toBe(true);
    });

    it('installs into VSCode format (.mdc) when using the cursor provider', () => {
      seedSkill(tmpDir, 'ks-mongodb-core');
      const target = path.join(tmpDir, 'cursor-target');

      const result = plugin.install({
        projectRoot: tmpDir,
        provider:    Provider.CURSOR,
        scope:       Scope.LOCAL,
        names:       ['ks-mongodb-core'],
        customDir:   target,
      });

      expect(result.succeeded).toContain('ks-mongodb-core');
      expect(result.errors).toHaveLength(0);
      expect(fs.existsSync(path.join(target, 'ks-mongodb-core.mdc'))).toBe(true);
    });

    it('captures errors in result when the source path does not exist', () => {
      const brokenRepo = {
        list: (_s: unknown, _c: string, _p: string, _comp: unknown) => [{
          name: 'ks-broken', path: 'skills/ks-broken', type: PackageType.SKILL,
          description: '', group: 'MongoDB', created: '', updated: '', version: '1.0.0',
          sourceRef: 'local',
        }],
        getLocalPath: () => path.join(tmpDir, 'nonexistent-source'),
      };
      const resolveSync = (key: string): unknown => {
        if (key.startsWith('apm:plugin:provider:')) return new StandardProvider();
        if (key === 'apm:plugin:repository:local')   return brokenRepo;
        throw new Error(`Test: unresolved IoC key: ${key}`);
      };
      const brokenPlugin = new Skill({
        assistant: { resolveSync } as unknown as IIoC,
        logger: undefined as any,
      });
      writeConfig(tmpDir);

      const result = brokenPlugin.install({
        projectRoot: tmpDir,
        provider:    Provider.STANDARD,
        scope:       Scope.LOCAL,
        names:       ['ks-broken'],
        customDir:   path.join(tmpDir, 'target'),
      });
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0][0]).toBe('ks-broken');
      expect(result.succeeded).toHaveLength(0);
    });

    it('returns elapsed time greater than or equal to zero', () => {
      seedSkill(tmpDir, 'ks-mongodb-core');
      const target = path.join(tmpDir, 'target');
      const result = plugin.install({
        projectRoot: tmpDir,
        provider:    Provider.STANDARD,
        scope:       Scope.LOCAL,
        names:       ['ks-mongodb-core'],
        customDir:   target,
      });
      expect(result.elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('uninstall()', () => {
    it('removes an installed skill directory', () => {
      seedSkill(tmpDir, 'ks-mongodb-core');
      const target = path.join(tmpDir, 'target');

      plugin.install({ projectRoot: tmpDir, provider: Provider.STANDARD, scope: Scope.LOCAL, names: ['ks-mongodb-core'], customDir: target });

      const result = plugin.uninstall({
        projectRoot: tmpDir,
        provider:    Provider.STANDARD,
        scope:       Scope.LOCAL,
        names:       ['ks-mongodb-core'],
        customDir:   target,
      });
      expect(result.succeeded).toContain('ks-mongodb-core');
      expect(fs.existsSync(path.join(target, 'ks-mongodb-core'))).toBe(false);
    });

    it('marks a package as skipped when it is not installed', () => {
      const target = path.join(tmpDir, 'target');
      fs.mkdirSync(target, { recursive: true });

      const result = plugin.uninstall({
        projectRoot: tmpDir,
        provider:    Provider.STANDARD,
        scope:       Scope.LOCAL,
        names:       ['ks-not-there'],
        customDir:   target,
      });
      expect(result.skipped).toContain('ks-not-there');
    });

    it('warns gracefully when the install path does not exist', () => {
      const result = plugin.uninstall({
        projectRoot: tmpDir,
        provider:    Provider.STANDARD,
        scope:       Scope.LOCAL,
        names:       ['ks-x'],
        customDir:   '/nonexistent/path',
      });
      expect(result.succeeded).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });
});
