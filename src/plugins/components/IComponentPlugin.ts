import fs from 'fs';
import { ApmPackage, InstalledMeta } from '../../models/package.model';
import { PackageType } from '../../models/provider.model';

/**
 * IComponentPlugin — the third microkernel extension point.
 *
 * A component plugin represents a single type of AI artifact (skill, agent,
 * hook, context). It owns the SOURCE-SIDE rules for that artifact:
 *
 *   matchEntry   — recognises this artifact type inside a source directory
 *   readMeta     — extracts ApmPackage metadata from a matched entry
 *   copyTo       — default install: copies the artifact to an install directory
 *   removeFrom   — default uninstall: deletes the artifact from an install directory
 *   listFrom     — lists artifacts installed in a directory (used by providers)
 *
 * Providers that apply format conversion (e.g. cursor converts SKILL.md → .mdc)
 * implement their own install/listInstalled and MAY delegate to copyTo/listFrom
 * for the source-format copy step.
 *
 * Registration (done once in bootstrap.ts):
 *   registerComponent(new SkillPlugin());
 *   registerComponent(new AgentPlugin());
 *
 * Lookup (in CLI commands and provider strategies):
 *   const plugin = getComponent(PackageType.SKILL);
 */
export interface IComponentPlugin {
  /** Canonical PackageType this plugin handles. */
  readonly type: PackageType;

  /**
   * Default subdirectory name within any install/source root.
   * e.g. 'skills' → .agents/skills/, .claude/skills/
   */
  readonly installSubdir: string;

  /**
   * Returns true when a directory entry inside a source directory represents
   * this component type and is ready to be listed as an ApmPackage.
   *
   * @param entry  - dirent from fs.readdirSync
   * @param parentDir - absolute path of the directory being scanned
   */
  matchEntry(entry: fs.Dirent, parentDir: string): boolean;

  /**
   * Read ApmPackage metadata fields from a matched entry.
   * Returns only the fields the plugin knows about; the caller merges the rest.
   *
   * @param entryPath - absolute path to the matched entry (dir or file)
   * @param entryName - bare filename/dirname of the entry
   */
  readMeta(entryPath: string, entryName: string): Partial<ApmPackage>;

  /**
   * Default install: copy the component from srcPath into installDir.
   * The installed artifact is named bareName (namespace prefix already stripped).
   *
   * @param srcPath    - absolute path of the source artifact
   * @param bareName   - destination name (no namespace prefix)
   * @param installDir - absolute path of the install directory
   */
  copyTo(srcPath: string, bareName: string, installDir: string): void;

  /**
   * Default uninstall: remove the installed artifact from installDir.
   * Throws an ENOENT-coded error when the artifact is not present.
   *
   * @param bareName   - bare name (no namespace prefix)
   * @param installDir - absolute path of the install directory
   */
  removeFrom(bareName: string, installDir: string): void;

  /**
   * Scan installDir and return metadata for every installed artifact of this
   * component type, with outdated detection against sourceMap.
   *
   * @param installDir - absolute path of the install directory
   * @param sourceMap  - Map<bareName, sourceUpdated> for outdated detection
   */
  listFrom(installDir: string, sourceMap: Map<string, string>): InstalledMeta[];
}
