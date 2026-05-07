/** One row in the apm.lock.json packages array. */
export interface IApmLockEntry {
  name: string;
  type: string;
  provider: string;
  scope: string;
  /** Absolute path of the installed copy. */
  installPath: string;
  /** `updated` date read from the installed copy's metadata. */
  installedUpdated: string;
  /** `updated` date from the source registry at install time. */
  sourceUpdated: string;
  isOutdated: boolean;
  /** ISO-8601 timestamp of when this entry was last recorded. */
  recordedAt: string;
}
