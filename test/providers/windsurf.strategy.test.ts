import fs from 'fs';
import path from 'path';
import os from 'os';
import { WindsurfProviderStrategy } from '../../src/plugins/providers/windsurf';
import { PackageType, Provider, Scope } from '../../src/models/provider.model';
import type { ApmPackage } from '../../src/models/package.model';

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `apm-windsurf-test-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function seedSkill(root: string, name: string): { pkg: ApmPackage; skillDir: string } {
  const skillDir = path.join(root, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\ndescription: Test skill\ncreated: 2024-01-01\nupdated: 2025-06-01\n---\n\n# ${name}\n\nContent here.\n`,
  );
  const pkg: ApmPackage = {
    name,
    path:        name,
    type:        PackageType.SKILL,
    description: 'Test skill',
    group:       'MongoDB',
    created:     '2024-01-01',
    updated:     '2025-06-01',
    localPath:   skillDir,
  };
  return { pkg, skillDir };
}

describe('WindsurfProviderStrategy', () => {
  let tmpDir: string;
  let strategy: WindsurfProviderStrategy;

  beforeEach(() => {
    tmpDir   = makeTmpDir();
    strategy = new WindsurfProviderStrategy();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('getInstallPath()', () => {
    it('returns local path under projectRoot', () => {
      const p = strategy.getInstallPath(Scope.LOCAL, '/project');
      expect(p).toBe(path.join('/project', '.windsurf', 'rules'));
    });

    it('returns global path under home directory', () => {
      const p = strategy.getInstallPath(Scope.GLOBAL, '/project');
      expect(p).toBe(path.join(os.homedir(), '.windsurf', 'rules'));
    });

    it('returns customDir when provided', () => {
      const custom = '/custom/rules';
      expect(strategy.getInstallPath(Scope.LOCAL, '/project', custom)).toBe(custom);
    });
  });

  describe('install()', () => {
    it('writes a .windsurfrules file with frontmatter and body', () => {
      const { pkg, skillDir } = seedSkill(tmpDir, 'ks-mongodb-core');
      const target = path.join(tmpDir, 'rules');
      fs.mkdirSync(target, { recursive: true });

      strategy.install(pkg, skillDir, target);

      const outFile = path.join(target, 'ks-mongodb-core.windsurfrules');
      expect(fs.existsSync(outFile)).toBe(true);
      const content = fs.readFileSync(outFile, 'utf-8');
      expect(content).toContain('description:');
      expect(content).toContain('Content here.');
    });

    it('strips namespace prefix from the output filename', () => {
      const { skillDir } = seedSkill(tmpDir, 'ks-mongodb-core');
      const namespacedPkg: ApmPackage = {
        name:        'mongodb/ks-mongodb-core',
        path:        'ks-mongodb-core',
        type:        PackageType.SKILL,
        description: 'Namespaced skill',
        group:       'MongoDB',
        created:     '2024-01-01',
        updated:     '2025-06-01',
        localPath:   skillDir,
      };
      const target = path.join(tmpDir, 'rules');
      fs.mkdirSync(target, { recursive: true });

      strategy.install(namespacedPkg, skillDir, target);

      expect(fs.existsSync(path.join(target, 'ks-mongodb-core.windsurfrules'))).toBe(true);
      expect(fs.existsSync(path.join(target, 'mongodb', 'ks-mongodb-core.windsurfrules'))).toBe(false);
    });

    it('silently skips agent packages', () => {
      const agentPkg: ApmPackage = {
        name: 'my-agent', path: 'my-agent.md', type: PackageType.AGENT,
        description: '', group: 'MongoDB', created: '', updated: '',
      };
      const target = path.join(tmpDir, 'rules');
      fs.mkdirSync(target, { recursive: true });
      expect(() => strategy.install(agentPkg, tmpDir, target)).not.toThrow();
      expect(fs.readdirSync(target)).toHaveLength(0);
    });

    it('throws when SKILL.md is missing', () => {
      const emptyDir = path.join(tmpDir, 'empty-skill');
      fs.mkdirSync(emptyDir, { recursive: true });
      const pkg: ApmPackage = {
        name: 'ks-missing', path: 'ks-missing', type: PackageType.SKILL,
        description: '', group: 'MongoDB', created: '', updated: '',
        localPath: emptyDir,
      };
      const target = path.join(tmpDir, 'rules');
      fs.mkdirSync(target, { recursive: true });
      expect(() => strategy.install(pkg, emptyDir, target)).toThrow(/SKILL\.md not found/);
    });
  });

  describe('uninstall()', () => {
    it('removes the .windsurfrules file', () => {
      const { pkg, skillDir } = seedSkill(tmpDir, 'ks-mongodb-core');
      const target = path.join(tmpDir, 'rules');
      fs.mkdirSync(target, { recursive: true });
      strategy.install(pkg, skillDir, target);

      strategy.uninstall('ks-mongodb-core', PackageType.SKILL, target);

      expect(fs.existsSync(path.join(target, 'ks-mongodb-core.windsurfrules'))).toBe(false);
    });

    it('strips namespace before removing', () => {
      const { pkg, skillDir } = seedSkill(tmpDir, 'ks-mongodb-core');
      const target = path.join(tmpDir, 'rules');
      fs.mkdirSync(target, { recursive: true });
      strategy.install(pkg, skillDir, target);

      expect(() => strategy.uninstall('mongodb/ks-mongodb-core', PackageType.SKILL, target)).not.toThrow();
      expect(fs.existsSync(path.join(target, 'ks-mongodb-core.windsurfrules'))).toBe(false);
    });

    it('throws ENOENT when the file is not installed', () => {
      const target = path.join(tmpDir, 'rules');
      fs.mkdirSync(target, { recursive: true });
      expect(() => strategy.uninstall('ks-not-installed', PackageType.SKILL, target))
        .toThrow(expect.objectContaining({ code: 'ENOENT' }));
    });
  });

  describe('listInstalled()', () => {
    it('returns installed skills with outdated detection', () => {
      const { pkg, skillDir } = seedSkill(tmpDir, 'ks-mongodb-core');
      const target = path.join(tmpDir, 'rules');
      fs.mkdirSync(target, { recursive: true });
      strategy.install(pkg, skillDir, target);

      const sourceMap = new Map([['ks-mongodb-core', '2025-07-01']]);
      const installed = strategy.listInstalled(target, PackageType.SKILL, sourceMap);

      expect(installed).toHaveLength(1);
      expect(installed[0].name).toBe('ks-mongodb-core');
      expect(installed[0].provider).toBe(Provider.WINDSURF);
      expect(installed[0].isOutdated).toBe(true);
    });

    it('returns empty array for agent type', () => {
      const target = path.join(tmpDir, 'rules');
      fs.mkdirSync(target, { recursive: true });
      const result = strategy.listInstalled(target, PackageType.AGENT, new Map());
      expect(result).toHaveLength(0);
    });

    it('returns empty array when install path does not exist', () => {
      const result = strategy.listInstalled('/nonexistent', PackageType.SKILL, new Map());
      expect(result).toHaveLength(0);
    });
  });
});
