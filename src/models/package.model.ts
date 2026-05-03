import type { PackageType, Provider, Scope } from './provider.model';

/** A package available in a source directory. */
export interface ApmPackage {
  name: string;
  /**
   * Path relative to the source root's skills/agents base directory.
   * e.g. `skills/ks-mongodb-core` for standard layout, `ks-core` for custom skillsPath.
   * Serialised in apm.json; used as a stable identifier.
   */
  path: string;
  type: PackageType;
  description: string;
  group: string;
  created: string;   // YYYY-MM-DD
  updated: string;   // YYYY-MM-DD
  version?: string;
  references?: string[];
  /**
   * Name of the ApmSource this package was discovered from.
   * Runtime field — serialised in apm.json, used by the installer
   * to look up the correct repository strategy.
   */
  sourceRef?: string;
  /**
   * Absolute local filesystem path to the package's root directory.
   * Runtime-only — NOT serialised; computed fresh on each list() call.
   * The installer uses this as the copy source, bypassing path reconstruction.
   */
  localPath?: string;
}

/** A package that has been installed to a provider target. */
export interface InstalledPackage {
  name: string;
  type: PackageType;
  provider: Provider;
  scope: Scope;
  /** Absolute path of the installed copy. */
  installPath: string;
  /** `updated` date read from the installed copy's metadata. */
  updated: string;
  /** `updated` date from the source registry (used for outdated detection). */
  sourceUpdated: string;
  isOutdated: boolean;
}

/** Root structure of `.agents/apm.json`. */
export interface ApmManifest {
  schemaVersion: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  packages: {
    skills: ApmPackage[];
    agents: ApmPackage[];
    hooks?: ApmPackage[];
  };
}

/** Summary returned after an install or uninstall run. */
export interface OperationResult {
  succeeded: string[];
  skipped:   string[];
  errors:    Array<[string, string]>;
  elapsed:   number;
  target:    string;
}
