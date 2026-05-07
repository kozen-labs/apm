import type { PackageType } from './PackageType';

/** A package available in a source directory. */
export interface IApmPackage {
  name: string;
  /**
   * Path relative to the source root's skills/agents base directory.
   * Serialised in apm.json; used as a stable identifier.
   */
  path: string;
  type: PackageType;
  description: string;
  group: string;
  created: string;
  updated: string;
  version?: string;
  references?: string[];
  /**
   * Name of the IApmSource this package was discovered from.
   * Runtime field — serialised in apm.json.
   */
  sourceRef?: string;
  /**
   * Absolute local filesystem path to the package's root directory.
   * Runtime-only — NOT serialised; computed fresh on each list() call.
   */
  localPath?: string;
}
