import fs from 'fs';
import path from 'path';
import os from 'os';
import { ApmManifestManager } from '../../src/services/manifest';
import { PackageType } from '../../src/models/PackageType';

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `apm-manifest-test-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeSkillMd(dir: string, name: string, meta: Record<string, string>): void {
  const skillDir = path.join(dir, '.agents', 'skills', name);
  fs.mkdirSync(skillDir, { recursive: true });
  const fm = Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join('\n');
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---\n${fm}\n---\n\n# ${name}\n`);
}

describe('ApmManifestManager', () => {
  let tmpDir: string;
  let manager: ApmManifestManager;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    manager = new ApmManifestManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('read()', () => {
    it('returns null when apm.json does not exist', async () => {
      expect(await manager.read()).toBeNull();
    });

    it('parses a valid apm.json', async () => {
      const manifestPath = path.join(tmpDir, '.agents', 'apm.json');
      fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
      fs.writeFileSync(manifestPath, JSON.stringify({
        schemaVersion: '1.0',
        name: 'test',
        displayName: 'Test',
        version: '1.0.0',
        description: '',
        packages: { skills: [], agents: [] },
      }));
      const manifest = await manager.read();
      expect(manifest).not.toBeNull();
      expect(manifest!.schemaVersion).toBe('1.0');
    });
  });

  describe('write()', () => {
    it('creates apm.json and the manifest can be read back', async () => {
      const manifest = {
        schemaVersion: '1.0',
        name: 'test',
        displayName: 'Test',
        version: '1.0.0',
        description: '',
        packages: { skills: [], agents: [] },
      };
      await manager.write(manifest);
      const readBack = await manager.read();
      expect(readBack).toEqual(manifest);
    });
  });

  describe('generate()', () => {
    it('returns a manifest with empty skill/agent lists when dirs are absent', async () => {
      const manifest = await manager.generate();
      expect(manifest.packages.skills).toEqual([]);
      expect(manifest.packages.agents).toEqual([]);
    });

    it('scans .agents/skills/ and includes ks-* directories with SKILL.md', async () => {
      writeSkillMd(tmpDir, 'ks-mongodb-core', {
        description: 'Core MongoDB skill',
        created: '2024-01-01',
        updated: '2025-04-01',
        version: '1.0.0',
      });
      writeSkillMd(tmpDir, 'ks-security-patterns', {
        description: 'Security patterns',
        created: '2024-06-01',
        updated: '2025-01-01',
        version: '1.0.0',
      });

      const manifest = await manager.generate();
      expect(manifest.packages.skills).toHaveLength(2);
      const names = manifest.packages.skills.map(s => s.name);
      expect(names).toContain('ks-mongodb-core');
      expect(names).toContain('ks-security-patterns');
    });

    it('sets type to SKILL for discovered skill packages', async () => {
      writeSkillMd(tmpDir, 'ks-mongodb-core', { description: '', created: '', updated: '', version: '1.0.0' });
      const manifest = await manager.generate();
      expect(manifest.packages.skills[0].type).toBe(PackageType.SKILL);
    });

    it('ignores directories not starting with ks-', async () => {
      const ignoredDir = path.join(tmpDir, '.agents', 'skills', 'not-a-skill');
      fs.mkdirSync(ignoredDir, { recursive: true });
      fs.writeFileSync(path.join(ignoredDir, 'SKILL.md'), '---\ndescription: x\n---\n');
      const manifest = await manager.generate();
      expect(manifest.packages.skills).toHaveLength(0);
    });
  });
});
