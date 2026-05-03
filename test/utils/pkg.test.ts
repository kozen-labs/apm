import { bareSkillName } from '../../src/utils/pkg';

describe('bareSkillName()', () => {
  it('returns the name unchanged when there is no namespace', () => {
    expect(bareSkillName('ks-mongodb-core')).toBe('ks-mongodb-core');
  });

  it('strips a single-level namespace prefix', () => {
    expect(bareSkillName('mongodb/ks-mongodb-core')).toBe('ks-mongodb-core');
  });

  it('strips only the last segment for multi-level paths', () => {
    expect(bareSkillName('org/team/ks-tool')).toBe('ks-tool');
  });

  it('handles a name that is just a slash-delimited pair', () => {
    expect(bareSkillName('a/b')).toBe('b');
  });

  it('returns an empty string when the name ends with a slash', () => {
    expect(bareSkillName('mongodb/')).toBe('');
  });
});
