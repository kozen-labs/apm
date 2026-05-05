import { Provider, Scope } from './provider.model';

export interface ComponentBaseOpts {
  projectRoot: string;
}

export interface ComponentInstallOpts extends ComponentBaseOpts {
  provider:   Provider;
  scope:      Scope;
  names:      string[];
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
