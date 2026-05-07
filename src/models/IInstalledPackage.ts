import type { PackageType } from './PackageType';
import type { Provider } from './Provider';
import type { Scope } from './Scope';

/** A package that has been installed to a provider target. */
export interface IInstalledPackage {
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
