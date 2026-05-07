import { PackageType } from '../../src/models/PackageType';
import { Provider } from '../../src/models/Provider';
import { Scope } from '../../src/models/Scope';
import { GROUPS, inferGroup } from '../../src/models/Groups';

describe('PackageType enum', () => {
  it('has the expected string values', () => {
    expect(PackageType.SKILL).toBe('skill');
    expect(PackageType.AGENT).toBe('agent');
    expect(PackageType.HOOK).toBe('hook');
  });
});

describe('Provider enum', () => {
  it('has the expected string values', () => {
    expect(Provider.STANDARD).toBe('standard');
    expect(Provider.CLAUDE).toBe('claude');
    expect(Provider.VSCODE).toBe('vscode');
  });
});

describe('Scope enum', () => {
  it('has the expected string values', () => {
    expect(Scope.LOCAL).toBe('local');
    expect(Scope.GLOBAL).toBe('global');
  });
});

describe('GROUPS', () => {
  it('exposes all five group labels', () => {
    expect(GROUPS.MONGODB).toBe('MongoDB');
    expect(GROUPS.SECURITY).toBe('Security');
    expect(GROUPS.SOFTWARE_ENGINEERING).toBe('Software Engineering');
    expect(GROUPS.TECHNOLOGIES).toBe('Technologies');
    expect(GROUPS.CONTENT).toBe('Content & Communication');
  });
});

describe('inferGroup()', () => {
  it('maps mongodb prefix to MongoDB group', () => {
    expect(inferGroup('ks-mongodb-core')).toBe(GROUPS.MONGODB);
    expect(inferGroup('ks-mongodb-atlas')).toBe(GROUPS.MONGODB);
  });

  it('maps security prefix to Security group', () => {
    expect(inferGroup('ks-security-patterns')).toBe(GROUPS.SECURITY);
  });

  it('maps software/ai/quality/project prefixes to Software Engineering group', () => {
    expect(inferGroup('ks-software-development')).toBe(GROUPS.SOFTWARE_ENGINEERING);
    expect(inferGroup('ks-ai-agent-development')).toBe(GROUPS.SOFTWARE_ENGINEERING);
    expect(inferGroup('ks-quality-assurance')).toBe(GROUPS.SOFTWARE_ENGINEERING);
    expect(inferGroup('ks-project-management')).toBe(GROUPS.SOFTWARE_ENGINEERING);
  });

  it('maps devops/apache/sql/artificial prefixes to Technologies group', () => {
    expect(inferGroup('ks-devops')).toBe(GROUPS.TECHNOLOGIES);
    expect(inferGroup('ks-apache-kafka')).toBe(GROUPS.TECHNOLOGIES);
    expect(inferGroup('ks-sql-databases')).toBe(GROUPS.TECHNOLOGIES);
    expect(inferGroup('ks-artificial-intelligence')).toBe(GROUPS.TECHNOLOGIES);
  });

  it('falls back to Content & Communication for unrecognised prefixes', () => {
    expect(inferGroup('ks-technical-article-writer')).toBe(GROUPS.CONTENT);
    expect(inferGroup('ks-unknown-skill')).toBe(GROUPS.CONTENT);
  });

  it('handles names without the ks- prefix', () => {
    expect(inferGroup('mongodb-core')).toBe(GROUPS.MONGODB);
  });
});
