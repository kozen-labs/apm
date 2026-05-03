import path from 'path';
import os from 'os';
import {
  resolveInstallPath,
  allSkillLocations,
  allAgentLocations,
  skillSourceBases,
  agentSourceBases,
} from '../../src/providers/path.resolver';
import { Provider, Scope } from '../../src/models/provider.model';

const PROJECT_ROOT = '/project';

describe('resolveInstallPath()', () => {
  it('returns the customDir when provided', () => {
    const custom = '/custom/skills';
    expect(resolveInstallPath(Provider.CLAUDE, Scope.LOCAL, PROJECT_ROOT, 'skill', custom)).toBe(custom);
  });

  it('resolves claude:global to ~/.claude/skills', () => {
    const expected = path.join(os.homedir(), '.claude', 'skills');
    expect(resolveInstallPath(Provider.CLAUDE, Scope.GLOBAL, PROJECT_ROOT)).toBe(expected);
  });

  it('resolves claude:local to <project>/.claude/skills', () => {
    const expected = path.join(PROJECT_ROOT, '.claude', 'skills');
    expect(resolveInstallPath(Provider.CLAUDE, Scope.LOCAL, PROJECT_ROOT)).toBe(expected);
  });

  it('resolves standard:local to <project>/.agents/skills', () => {
    const expected = path.join(PROJECT_ROOT, '.agents', 'skills');
    expect(resolveInstallPath(Provider.STANDARD, Scope.LOCAL, PROJECT_ROOT)).toBe(expected);
  });

  it('resolves standard:global to ~/.agents/skills', () => {
    const expected = path.join(os.homedir(), '.agents', 'skills');
    expect(resolveInstallPath(Provider.STANDARD, Scope.GLOBAL, PROJECT_ROOT)).toBe(expected);
  });

  it('resolves vscode:local to <project>/.cursor/rules', () => {
    const expected = path.join(PROJECT_ROOT, '.cursor', 'rules');
    expect(resolveInstallPath(Provider.VSCODE, Scope.LOCAL, PROJECT_ROOT)).toBe(expected);
  });

  it('resolves agent type for claude:global to ~/.claude/agents', () => {
    const expected = path.join(os.homedir(), '.claude', 'agents');
    expect(resolveInstallPath(Provider.CLAUDE, Scope.GLOBAL, PROJECT_ROOT, 'agent')).toBe(expected);
  });
});

describe('allSkillLocations()', () => {
  it('returns six entries (3 providers × 2 scopes)', () => {
    const locs = allSkillLocations(PROJECT_ROOT);
    expect(locs).toHaveLength(6);
  });

  it('every entry has provider, scope, and path fields', () => {
    for (const loc of allSkillLocations(PROJECT_ROOT)) {
      expect(loc).toHaveProperty('provider');
      expect(loc).toHaveProperty('scope');
      expect(loc).toHaveProperty('path');
    }
  });
});

describe('allAgentLocations()', () => {
  it('returns six entries', () => {
    expect(allAgentLocations(PROJECT_ROOT)).toHaveLength(6);
  });
});

describe('skillSourceBases()', () => {
  it('returns at least the .agents/skills base', () => {
    const bases = skillSourceBases(PROJECT_ROOT);
    const expected = path.join(PROJECT_ROOT, '.agents', 'skills');
    expect(bases).toContain(expected);
  });
});

describe('agentSourceBases()', () => {
  it('returns at least the .agents/agents base', () => {
    const bases = agentSourceBases(PROJECT_ROOT);
    const expected = path.join(PROJECT_ROOT, '.agents', 'agents');
    expect(bases).toContain(expected);
  });
});
