/**
 * Minimal per-entry result returned by IComponent.listFrom().
 * Providers stamp provider + scope + type before returning IInstalledPackage.
 */
export interface IInstalledMeta {
  name: string;
  installPath: string;
  installedUpdated: string;
  sourceUpdated: string;
  isOutdated: boolean;
}
