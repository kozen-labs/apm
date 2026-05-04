import os from 'os';
import path from 'path';
import fs from 'fs';
import { CONFIG_FILENAME } from '../core/config';

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
 * Walk up from `startDir` looking for a directory that contains `.agents/`
 * or `apm.pack.json`. If APM_CONFIG env var points to an existing file,
 * its directory is returned immediately.
 *
 * Falls back to the directory two levels above __dirname (the npm package root)
 * when run as a globally installed binary.
 */
export function findProjectRoot(startDir: string = process.cwd()): string {
  // APM_CONFIG env var takes highest priority
  const envConfig = process.env.APM_CONFIG;
  if (envConfig) {
    const resolved = path.resolve(envConfig);
    if (fs.existsSync(resolved)) return path.dirname(resolved);
  }

  let dir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(dir, '.agents')))           return dir;
    if (fs.existsSync(path.join(dir, CONFIG_FILENAME)))     return dir;
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
