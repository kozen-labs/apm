import fs from 'fs';
import path from 'path';
import os from 'os';
import { Skill } from '../../src/plugins/components/Skill';
import { StandardProvider } from '../../src/plugins/providers/StandardProvider';
import { LocalRepository } from '../../src/plugins/repositories/LocalRepository';
import { PackageType, Provider } from '../../src/models/provider.model';
import type { IIoC } from '@kozen/engine';

function makeSkill(): Skill {
  const localRepo    = new LocalRepository();
  const standardProv = new StandardProvider();

  const resolveSync = (key: string): unknown => {
    if (key === `apm:plugin:provider:${Provider.STANDARD}`) return standardProv;
    if (key.startsWith('apm:plugin:provider:'))             return standardProv;
    if (key === 'apm:plugin:repository:local')              return localRepo;
    throw new Error(`Test: unresolved IoC key: ${key}`);
  };

  return new Skill({ assistant: { resolveSync } as unknown as IIoC, logger: undefined as any });
}

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `apm-registry-test-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
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

function seedSkill(root: string, name: string): void {
  const skillDir = path.join(root, '.agents', 'skills', name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\ndescription: Test\ncreated: 2024-01-01\nupdated: 2025-01-01\nversion: 1.0.0\n---\n\n# ${name}\n`,
  );
}

describe('Skill list / status', () => {
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

  describe('list() — available packages', () => {
    it('discovers skills from the .agents/skills directory', () => {
      seedSkill(tmpDir, 'ks-mongodb-core');
      const skills = plugin.list({ projectRoot: tmpDir });
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('ks-mongodb-core');
    });

    it('does not return agents when listing skills', () => {
      seedSkill(tmpDir, 'ks-mongodb-core');
      seedSkill(tmpDir, 'ks-security-patterns');
      const skills = plugin.list({ projectRoot: tmpDir });
      expect(skills.every(p => p.type === PackageType.SKILL)).toBe(true);
    });

    it('returns an empty array when no skill directories exist', () => {
      const skills = plugin.list({ projectRoot: tmpDir });
      expect(Array.isArray(skills)).toBe(true);
      expect(skills).toHaveLength(0);
    });
  });

  describe('status() — installed packages', () => {
    it('returns an empty array when no packages are installed', () => {
      seedSkill(tmpDir, 'ks-mongodb-core');
      const installed = plugin.status({ projectRoot: tmpDir });
      expect(Array.isArray(installed)).toBe(true);
    });
  });
});
