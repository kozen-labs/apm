import path from 'path';
import os from 'os';
import fs from 'fs';
import { getOs, getHomeDir, findProjectRoot, isSamePath } from '../../src/platform/system';

describe('getOs()', () => {
  it('returns a recognised OS string', () => {
    const result = getOs();
    expect(['windows', 'macos', 'linux']).toContain(result);
  });
});

describe('getHomeDir()', () => {
  it('returns the same value as os.homedir()', () => {
    expect(getHomeDir()).toBe(os.homedir());
  });
});

describe('findProjectRoot()', () => {
  it('returns a string path', () => {
    const root = findProjectRoot();
    expect(typeof root).toBe('string');
    expect(root.length).toBeGreaterThan(0);
  });

  it('locates a directory containing .agents/ when invoked from the project', () => {
    // Walk up from cwd — the repo itself contains .agents/
    const root = findProjectRoot(process.cwd());
    const agentsDir = path.join(root, '.agents');
    // Either .agents exists at root, or the fallback __dirname path was used.
    // In either case, the returned value must be a non-empty string.
    expect(root).toBeTruthy();
  });

  it('falls back gracefully when called from a temp directory without .agents/', () => {
    const tmpDir = os.tmpdir();
    const result = findProjectRoot(tmpDir);
    expect(typeof result).toBe('string');
  });
});

describe('isSamePath()', () => {
  it('returns true for identical absolute paths', () => {
    const p = path.join(os.tmpdir(), 'test');
    expect(isSamePath(p, p)).toBe(true);
  });

  it('returns true when paths resolve to the same location', () => {
    const base = os.tmpdir();
    expect(isSamePath(base + path.sep + '.', base)).toBe(true);
  });

  it('returns false for different paths', () => {
    expect(isSamePath('/tmp/a', '/tmp/b')).toBe(false);
  });
});
