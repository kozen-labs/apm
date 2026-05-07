import type { IComponentBaseOpts } from './IComponentBaseOpts';

export interface IComponentSetupOpts extends IComponentBaseOpts {
  provider:        string;
  scope:           string;
  enableCommunity: boolean;
  force:           boolean;
  configPath?:     string;
}
