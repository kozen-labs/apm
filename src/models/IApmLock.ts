import type { IApmLockEntry } from './IApmLockEntry';

/** Schema for apm.lock.json. */
export interface IApmLock {
  schemaVersion: string;
  /** ISO-8601 timestamp of when the file was last written. */
  generatedAt: string;
  packages: IApmLockEntry[];
}
