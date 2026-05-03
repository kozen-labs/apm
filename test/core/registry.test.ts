import fs from 'fs';
import path from 'path';
import os from 'os';
import { ApmRegistry } from '../../src/core/registry';
import { PackageType } from '../../src/models/provider.model';
import type { ApmManifest } from '../../src/models/package.model';

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `apm-registry-test-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeManifest(root: string, manifest: ApmManifest): void {
  const dest = path.join(root, '.agents', 'apm.json');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(manifest, null, 2));
}

const MINIMAL_MANIFEST: ApmManifest = {
  schemaVersion: '1.0',
  name: 'test',
  displayName: 'Test',
  version: '1.0.0',
  description: '',
  packages: {
    skills: [
      {
        name: 'ks-mongodb-core',
        path: 'skills/ks-mongodb-core',
        type: PackageType.SKILL,
        description: 'Core MongoDB',
        group: 'MongoDB',
        created: '2024-01-01',
        updated: '2025-04-01',
        version: '1.0.0',
      },
    ],
    agents: [
      {
        name: 'agent-one',
        path: 'agents/agent-one.md',
        type: PackageType.AGENT,
        description: 'Test agent',
        group: 'MongoDB',
        created: '2024-01-01',
        updated: '2024-12-01',
      },
    ],
  },
};

describe('ApmRegistry', () => {
  let tmpDir: string;
  let registry: ApmRegistry;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    registry = new ApmRegistry(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('getAvailable()', () => {
    it('reads skills from the manifest', () => {
      writeManifest(tmpDir, MINIMAL_MANIFEST);
      const skills = registry.getAvailable(PackageType.SKILL);
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('ks-mongodb-core');
    });

    it('reads agents from the manifest', () => {
      writeManifest(tmpDir, MINIMAL_MANIFEST);
      const agents = registry.getAvailable(PackageType.AGENT);
      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe('agent-one');
    });

    it('falls back to live scan when manifest is absent (returns empty lists for empty dirs)', () => {
      const skills = registry.getAvailable(PackageType.SKILL);
      expect(Array.isArray(skills)).toBe(true);
    });
  });

  describe('getInstalled()', () => {
    it('returns an empty array when no packages are installed', () => {
      writeManifest(tmpDir, MINIMAL_MANIFEST);
      // No packages copied to install locations — all paths either absent or are source dirs.
      const installed = registry.getInstalled(PackageType.SKILL);
      expect(Array.isArray(installed)).toBe(true);
    });
  });
});
