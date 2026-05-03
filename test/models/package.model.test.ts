import type { ApmPackage, InstalledPackage, ApmManifest, OperationResult } from '../../src/models/package.model';
import { PackageType, Provider, Scope } from '../../src/models/provider.model';

describe('ApmPackage interface', () => {
  it('accepts a fully populated package object', () => {
    const pkg: ApmPackage = {
      name: 'ks-mongodb-core',
      path: 'skills/ks-mongodb-core',
      type: PackageType.SKILL,
      description: 'Core MongoDB skill',
      group: 'MongoDB',
      created: '2024-01-01',
      updated: '2025-04-01',
      version: '1.0.0',
    };
    expect(pkg.name).toBe('ks-mongodb-core');
    expect(pkg.type).toBe(PackageType.SKILL);
  });

  it('allows optional fields to be omitted', () => {
    const pkg: ApmPackage = {
      name: 'ks-minimal',
      path: 'skills/ks-minimal',
      type: PackageType.SKILL,
      description: '',
      group: 'MongoDB',
      created: '',
      updated: '',
    };
    expect(pkg.version).toBeUndefined();
    expect(pkg.references).toBeUndefined();
  });
});

describe('InstalledPackage interface', () => {
  it('computes isOutdated correctly', () => {
    const outdated: InstalledPackage = {
      name: 'ks-mongodb-core',
      type: PackageType.SKILL,
      provider: Provider.CLAUDE,
      scope: Scope.GLOBAL,
      installPath: '/home/user/.claude/skills/ks-mongodb-core',
      updated: '2024-01-01',
      sourceUpdated: '2025-04-01',
      isOutdated: true,
    };
    expect(outdated.isOutdated).toBe(true);

    const upToDate: InstalledPackage = {
      ...outdated,
      updated: '2025-04-01',
      isOutdated: false,
    };
    expect(upToDate.isOutdated).toBe(false);
  });
});

describe('ApmManifest interface', () => {
  it('accepts a valid manifest with skills and agents', () => {
    const manifest: ApmManifest = {
      schemaVersion: '1.0',
      name: 'sdlc-skills-pack',
      displayName: 'SDLC Skills Pack',
      version: '2.0.0',
      description: 'Test manifest',
      packages: {
        skills: [],
        agents: [],
      },
    };
    expect(manifest.schemaVersion).toBe('1.0');
  });
});

describe('OperationResult interface', () => {
  it('holds arrays for succeeded, skipped, and errors', () => {
    const result: OperationResult = {
      succeeded: ['ks-mongodb-core'],
      skipped: [],
      errors: [['ks-broken', 'ENOENT']],
      elapsed: 0.42,
      target: '/tmp/skills',
    };
    expect(result.succeeded).toHaveLength(1);
    expect(result.errors[0][0]).toBe('ks-broken');
  });
});
