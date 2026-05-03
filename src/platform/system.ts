import os from 'os';
import path from 'path';
import fs from 'fs';

export type OsType = 'windows' | 'macos' | 'linux';

export function getOs(): OsType {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  return 'linux';
}

export function getHomeDir(): string {
  return os.homedir();
}

/**
 * Walk up from `startDir` looking for a directory that contains `.agents/`.
 * Falls back to the directory two levels above __dirname (the npm package root)
 * when run as a globally installed binary.
 */
export function findProjectRoot(startDir: string = process.cwd()): string {
  let dir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(dir, '.agents'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: the npm package's own bundled .agents/
  return path.resolve(__dirname, '..', '..');
}

/** Return true when `candidate` resolves to the same path as `reference`. */
export function isSamePath(candidate: string, reference: string): boolean {
  try {
    return path.resolve(candidate) === path.resolve(reference);
  } catch {
    return false;
  }
}
