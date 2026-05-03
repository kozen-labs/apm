import { ApmPackage, InstalledPackage } from '../models/package.model';
import { PackageType, Scope } from '../models/provider.model';

/**
 * Provider strategy interface — Microkernel plugin contract.
 *
 * Each implementation handles one AI tool provider (standard, claude, vscode, …).
 * Register new providers without modifying any existing code:
 *
 *   PluginRegistry.registerProvider(new MyProviderStrategy());
 *
 * Responsibilities:
 *   - Resolve install paths for local and global scopes.
 *   - Install individual packages (copy, convert, or transform as needed).
 *   - Uninstall individual packages.
 *   - Scan an install directory and return installed packages with
 *     outdated-detection metadata.
 *   - Optional post-install hook (e.g. write manifest.json for claude).
 */
export interface IProviderStrategy {
  /** Matches Provider enum value — used by PluginRegistry for dispatch. */
  readonly name: string;

  /**
   * Resolve the absolute install path for this provider and scope.
   *
   * @param scope       local | global
   * @param projectRoot Absolute project root (used for local-scope paths).
   * @param customDir   When provided, overrides the computed path entirely.
   */
  getInstallPath(scope: Scope, projectRoot: string, customDir?: string): string;

  /**
   * Install a single package into installPath.
   *
   * @param pkg          Package descriptor.
   * @param pkgLocalPath Absolute path to the package's source directory.
   * @param installPath  Absolute path to the provider's install directory.
   */
  install(pkg: ApmPackage, pkgLocalPath: string, installPath: string): void;

  /**
   * Remove a single installed package from installPath.
   *
   * @param name        Package name.
   * @param type        SKILL | AGENT | HOOK.
   * @param installPath Absolute path to the provider's install directory.
   */
  uninstall(name: string, type: PackageType, installPath: string): void;

  /**
   * Scan installPath and return all recognised installed packages.
   * Implementations should set isOutdated by comparing updated dates
   * from the package metadata against sourceMap.
   *
   * @param installPath Absolute path to the provider's install directory.
   * @param type        Package type to scan for.
   * @param sourceMap   name → updated date from the source registry.
   */
  listInstalled(
    installPath: string,
    type: PackageType,
    sourceMap: Map<string, string>,
  ): InstalledPackage[];

  /**
   * Optional hook executed once after all packages have been installed.
   * Used by ClaudeProviderStrategy to write manifest.json.
   * Default implementation is a no-op.
   */
  postInstall(installPath: string, sourceRoot: string): void;
}
