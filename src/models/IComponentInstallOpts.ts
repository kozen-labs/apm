import type { Provider } from './Provider';
import type { Scope } from './Scope';
import type { IComponentBaseOpts } from './IComponentBaseOpts';

export interface IComponentInstallOpts extends IComponentBaseOpts {
  provider:   Provider;
  scope:      Scope;
  names:      string[];
  customDir?: string;
}
