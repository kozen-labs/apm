import fs from 'fs';
import path from 'path';
import os from 'os';
import { bootstrap } from '../../src/plugins/bootstrap';
import { Skill } from '../../src/plugins/components/Skill';
import { PackageType, Provider, Scope } from '../../src/models/provider.model';
import type { ApmPackage } from '../../src/models/package.model';

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `apm-installer-test-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function seedSkill(root: string, name: string): ApmPackage {
  const skillDir = path.join(root, '.agents', 'skills', name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\ndescription: Test skill\ncreated: 2024-01-01\nupdated: 2025-01-01\nversion: 1.0.0\n---\n\n# ${name}\n`,
  );
  return {
    name,
    path:        `skills/${name}`,
    type:        PackageType.SKILL,
    description: 'Test skill',
    group:       'MongoDB',
    created:     '2024-01-01',
    updated:     '2025-01-01',
    version:     '1.0.0',
    localPath:   skillDir,
  };
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

  beforeAll(() => { bootstrap(); });

  beforeEach(() => {
    tmpDir = makeTmpDir();
    plugin = new Skill();
    writeConfig(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('install()', () => {
    it('copies a skill directory to the target location', () => {
      const pkg    = seedSkill(tmpDir, 'ks-mongodb-core');
      const target = path.join(tmpDir, 'install-target', 'skills');

      const result = plugin.install({
        projectRoot: tmpDir,
        provider:    Provider.STANDARD,
        scope:       Scope.LOCAL,
        names:       [pkg.name],
        customDir:   target,
      });

      expect(result.succeeded).toContain('ks-mongodb-core');
      expect(result.errors).toHaveLength(0);
      expect(fs.existsSync(path.join(target, 'ks-mongodb-core', 'SKILL.md'))).toBe(true);
    });

    it('reports an error when the source SKILL.md is missing (vscode provider)', () => {
      const brokenPkg: ApmPackage = {
        name:        'ks-missing',
        path:        'skills/ks-missing',
        type:        PackageType.SKILL,
        description: '',
        group:       'MongoDB',
        created:     '',
        updated:     '',
        localPath:   path.join(tmpDir, 'nonexistent'),
      };
      const target = path.join(tmpDir, 'install-target', 'vscode');

      // Write the manifest so fetchAvailable finds the package
      const manifestDir = path.join(tmpDir, '.agents');
      fs.mkdirSync(manifestDir, { recursive: true });
      fs.writeFileSync(path.join(manifestDir, 'apm.json'), JSON.stringify({
        schemaVersion: '1.0', name: 't', displayName: 'T', version: '1.0.0', description: '',
        packages: { skills: [brokenPkg], agents: [] },
      }));

      const result = plugin.install({
        projectRoot: tmpDir,
        provider:    Provider.VSCODE,
        scope:       Scope.LOCAL,
        names:       ['ks-missing'],
        customDir:   target,
      });
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0][0]).toBe('ks-missing');
    });

    it('returns elapsed time greater than or equal to zero', () => {
      const pkg    = seedSkill(tmpDir, 'ks-mongodb-core');
      const target = path.join(tmpDir, 'target');
      const result = plugin.install({
        projectRoot: tmpDir,
        provider:    Provider.STANDARD,
        scope:       Scope.LOCAL,
        names:       [pkg.name],
        customDir:   target,
      });
      expect(result.elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('uninstall()', () => {
    it('removes an installed skill directory', () => {
      const pkg    = seedSkill(tmpDir, 'ks-mongodb-core');
      const target = path.join(tmpDir, 'target');

      plugin.install({ projectRoot: tmpDir, provider: Provider.STANDARD, scope: Scope.LOCAL, names: [pkg.name], customDir: target });

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
