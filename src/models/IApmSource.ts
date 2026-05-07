import type { SourceType } from './SourceType';

/**
 * A single package source entry in apm.pack.json.
 * Each source maps to a repository strategy identified by its `type` field.
 */
export interface IApmSource {
  /** Unique label — used as cache directory name and in error messages. */
  name: string;
  type: SourceType;

  /** local: path to the repository root (resolved relative to project root). */
  path?: string;

  /** github: full HTTPS clone URL. */
  url?: string;
  /** github: branch, tag, or ref to clone/checkout. */
  ref?: string;

  /** npm: package name that bundles a .agents/ tree. */
  package?: string;

  /**
   * Path within the source root where skill directories live.
   * Default: '.agents/skills'
   */
  skillsPath?: string;
  /** Path within the source root where agent .md files live. Default: '.agents/agents' */
  agentsPath?: string;
  /** Path within the source root where hook scripts live. Default: '.agents/hooks' */
  hooksPath?: string;

  /**
   * Namespace prefix applied to package names from this source to avoid collisions.
   * e.g. namespace 'mongodb' turns 'ks-core' into 'mongodb/ks-core'.
   */
  namespace?: string;

  /**
   * Set true when the repository root itself is a single skill/agent
   * (no subdirectory per package).
   */
  singleResource?: boolean;
  /** Explicit package name for single-resource repos (default: source.name). */
  resourceName?: string;

  description?: string;
  /** When false, the source is skipped in list/install operations. Default: true. */
  enabled?: boolean;
}
