import { ApmPackage, InstalledPackage } from '../../models/package.model';
import { PackageType, Scope } from '../../models/provider.model';

/**
 * IProviderStrategy — Microkernel plugin contract for install targets.
 *
 * Each implementation handles one AI tool provider (standard, claude, cursor, …).
 * Register new providers without modifying any existing code:
 *
 *   registerProvider(new MyProviderStrategy());
 *
 * Responsibilities:
 *   - Resolve install paths for local and global scopes.
 *   - Install individual packages (copy, convert, or transform as needed).
 *   - Uninstall individual packages.
 *   - Scan an install directory and return installed packages with
 *     outdated-detection metadata.
 *   - Optional post-install hook (e.g. write manifest.json for claude).
 *
 * Providers that apply format conversion (cursor → .mdc, windsurf → .windsurfrules)
 * implement their own install/listInstalled. Providers that copy source files
 * as-is (standard, claude) delegate to IComponentPlugin.copyTo/listFrom.
 */
export interface IProviderStrategy {
  /** Matches Provider enum value — used by PluginRegistry for dispatch. */
  readonly name: string;

  /** Resolve the absolute install path for this provider and scope. */
  getInstallPath(scope: Scope, projectRoot: string, customDir?: string): string;

  /** Install a single package into installPath. */
  install(pkg: ApmPackage, pkgLocalPath: string, installPath: string): void;

  /** Remove a single installed package from installPath. Throws ENOENT when not found. */
  uninstall(name: string, type: PackageType, installPath: string): void;

  /**
   * Scan installPath and return all recognised installed packages.
   * Sets isOutdated by comparing metadata dates against sourceMap.
   */
  listInstalled(installPath: string, type: PackageType, sourceMap: Map<string, string>): InstalledPackage[];

  /** Optional hook executed once after all packages have been installed. */
  postInstall(installPath: string, sourceRoot: string): void;
}
