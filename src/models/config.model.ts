/**
 * Types for apm.config.json and apm.lock.json.
 * Both files live at the project root and are gitignored.
 */

/**
 * Supported source types.
 * local  — local filesystem directory.
 * github — GitHub repository fetched via git clone.
 * npm    — reserved for future npm package sources.
 */
export type SourceType = 'local' | 'github' | 'npm';

/**
 * A single package source entry in apm.config.json.
 *
 * Each source maps to a repository strategy plugin (IRepositoryStrategy)
 * identified by its `type` field. The strategy handles discovery, caching,
 * and refresh for that source type.
 *
 * Path conventions within a source:
 *   skillsPath  — where skill directories live (default: '.agents/skills')
 *   agentsPath  — where agent .md files live  (default: '.agents/agents')
 *   hooksPath   — where hook scripts live      (default: '.agents/hooks')
 *
 * For repos where the repository root IS the single resource, set
 * singleResource: true and optionally provide resourceName.
 */
export interface ApmSource {
  /** Unique label — used as cache directory name and in error messages. */
  name: string;
  type: SourceType;

  // ── local ──────────────────────────────────────────────────────────────
  /** local: path to the repository root (resolved relative to project root). */
  path?: string;

  // ── github ─────────────────────────────────────────────────────────────
  /** github: full HTTPS clone URL, e.g. https://github.com/mongodb/agent-skills */
  url?: string;
  /** github: branch, tag, or ref to clone/checkout (default: repo default branch). */
  ref?: string;

  // ── npm (reserved) ─────────────────────────────────────────────────────
  /** npm: package name that bundles a .agents/ tree. */
  package?: string;

  // ── path overrides (all source types) ──────────────────────────────────
  /**
   * Path within the source root where skill directories live.
   * Default: '.agents/skills'
   * Examples: 'skills', '.claude/skills', '.'
   */
  skillsPath?: string;
  /**
   * Path within the source root where agent .md files live.
   * Default: '.agents/agents'
   */
  agentsPath?: string;
  /**
   * Path within the source root where hook scripts live.
   * Default: '.agents/hooks'
   */
  hooksPath?: string;

  /**
   * Namespace prefix applied to package names from this source.
   * Avoids name collisions when multiple sources contain same-named packages.
   * e.g. namespace 'mongodb' turns 'ks-core' into 'mongodb/ks-core'.
   * If omitted, package names are used as-is.
   */
  namespace?: string;

  // ── single-resource repos ───────────────────────────────────────────────
  /**
   * Set true when the repository root itself is a single skill/agent
   * (no subdirectory per package). The source's skillsPath becomes the
   * package directory directly.
   */
  singleResource?: boolean;
  /** Explicit package name for single-resource repos (default: source.name). */
  resourceName?: string;

  // ── lifecycle ──────────────────────────────────────────────────────────
  description?: string;
  /** When false, the source is skipped in list/install operations. Default: true. */
  enabled?: boolean;
}

/**
 * Schema for apm.config.json.
 * Controls which sources APM discovers packages from and the default install target.
 */
export interface ApmConfig {
  schemaVersion: string;
  sources: ApmSource[];
  /** Default provider used when --provider is omitted. */
  defaultProvider?: string;
  /** Default scope used when --scope is omitted. */
  defaultScope?: string;
}

/** One row in the apm.lock.json packages array. */
export interface ApmLockEntry {
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

/** Schema for apm.lock.json. */
export interface ApmLock {
  schemaVersion: string;
  /** ISO-8601 timestamp of when the file was last written. */
  generatedAt: string;
  packages: ApmLockEntry[];
}
