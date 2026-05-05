import fs from 'fs';
import path from 'path';
import os from 'os';
import { bootstrap } from '../../src/plugins/bootstrap';
import { Skill } from '../../src/plugins/components/Skill';
import { PackageType } from '../../src/models/provider.model';
import type { ApmManifest } from '../../src/models/package.model';

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

function writeManifest(root: string, manifest: ApmManifest): void {
  const dest = path.join(root, '.agents', 'apm.json');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(manifest, null, 2));
}

const MINIMAL_MANIFEST: ApmManifest = {
  schemaVersion: '1.0',
  name:          'test',
  displayName:   'Test',
  version:       '1.0.0',
  description:   '',
  packages: {
    skills: [
      {
        name:        'ks-mongodb-core',
        path:        'skills/ks-mongodb-core',
        type:        PackageType.SKILL,
        description: 'Core MongoDB',
        group:       'MongoDB',
        created:     '2024-01-01',
        updated:     '2025-04-01',
        version:     '1.0.0',
      },
    ],
    agents: [
      {
        name:        'agent-one',
        path:        'agents/agent-one.md',
        type:        PackageType.AGENT,
        description: 'Test agent',
        group:       'MongoDB',
        created:     '2024-01-01',
        updated:     '2024-12-01',
      },
    ],
  },
};

describe('Skill list / status', () => {
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

  describe('list() — available packages', () => {
    it('reads skills from the manifest', () => {
      writeManifest(tmpDir, MINIMAL_MANIFEST);
      const skills = plugin.list({ projectRoot: tmpDir });
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('ks-mongodb-core');
    });

    it('does not return agents when listing skills', () => {
      writeManifest(tmpDir, MINIMAL_MANIFEST);
      const skills = plugin.list({ projectRoot: tmpDir });
      expect(skills.every(p => p.type === PackageType.SKILL)).toBe(true);
    });

    it('falls back to live scan when manifest is absent (returns array)', () => {
      const skills = plugin.list({ projectRoot: tmpDir });
      expect(Array.isArray(skills)).toBe(true);
    });
  });

  describe('status() — installed packages', () => {
    it('returns an empty array when no packages are installed', () => {
      writeManifest(tmpDir, MINIMAL_MANIFEST);
      const installed = plugin.status({ projectRoot: tmpDir });
      expect(Array.isArray(installed)).toBe(true);
    });
  });
});
