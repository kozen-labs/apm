import fs from 'fs';
import { ApmPackage, ApmManifest, InstalledMeta, InstalledPackage, OperationResult } from '../../models/package.model';
import { PackageType, Provider, Scope } from '../../models/provider.model';

// ── Action option types ────────────────────────────────────────────────────

export interface ComponentBaseOpts {
  projectRoot: string;
}

export interface ComponentInstallOpts extends ComponentBaseOpts {
  provider: Provider;
  scope:    Scope;
  names:    string[];   // empty = all available
  customDir?: string;
}

export interface ComponentSetupOpts extends ComponentBaseOpts {
  provider:        string;
  scope:           string;
  enableCommunity: boolean;
  force:           boolean;
  configPath?:     string;
}

export interface ComponentRefreshOpts extends ComponentBaseOpts {
  sourceName?: string;
}

// ── Interface ──────────────────────────────────────────────────────────────

/**
 * IComponentPlugin — microkernel extension point for a single artifact type.
 *
 * Two responsibility groups:
 *
 * 1. File operations (type-specific, abstract in BaseComponentPlugin):
 *    matchEntry, readMeta, copyTo, removeFrom, listFrom
 *    These define what the artifact looks like on disk.
 *
 * 2. Action methods (shared via BaseComponentPlugin, overridable per type):
 *    install, uninstall, list, status, outdated, setup, manifest, refresh
 *    These implement all CLI/MCP operations for this component type.
 *    The CLI controller dispatches actions by resolving the plugin by type key.
 *
 * Registration:
 *   IoC key:        apm:plugin:component:<type>   (e.g. apm:plugin:component:skill)
 *   PluginRegistry: registerComponent(new SkillPlugin())
 */
export interface IComponentPlugin {
  /** Canonical PackageType this plugin handles. */
  readonly type: PackageType;

  /** Default subdirectory within any install/source root (e.g. 'skills', 'agents'). */
  readonly installSubdir: string;

  // ── File operations (type-specific) ─────────────────────────────────────

  matchEntry(entry: fs.Dirent, parentDir: string): boolean;
  readMeta(entryPath: string, entryName: string): Partial<ApmPackage>;
  copyTo(srcPath: string, bareName: string, installDir: string): void;
  removeFrom(bareName: string, installDir: string): void;
  listFrom(installDir: string, sourceMap: Map<string, string>): InstalledMeta[];

  // ── Action methods (shared, per-type dispatch by CLI/MCP controller) ─────

  install(opts: ComponentInstallOpts): OperationResult;
  uninstall(opts: ComponentInstallOpts): OperationResult;

  /** Returns all available packages of this type; caller handles display. */
  list(opts: ComponentBaseOpts): ApmPackage[];

  /**
   * Returns all installed packages of this type and writes the lock file.
   * Caller handles display.
   */
  status(opts: ComponentBaseOpts): InstalledPackage[];

  /**
   * Returns only outdated installed packages and writes the lock file.
   * Caller handles display.
   */
  outdated(opts: ComponentBaseOpts): InstalledPackage[];

  /** Initialises apm.pack.json + apm.lock.json; prompts resolved before call. */
  setup(opts: ComponentSetupOpts): void;

  /** Regenerates .agents/apm.json and returns the manifest. */
  manifest(opts: ComponentBaseOpts): ApmManifest;

  /** Refreshes remote sources (github, npm, etc.). */
  refresh(opts: ComponentRefreshOpts): void;
}
