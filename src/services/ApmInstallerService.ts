import { BaseService } from '@kozen/engine';
import { IIoC } from '@kozen/engine';
import { ILogger } from '@kozen/engine';
import { ApmPackage, OperationResult } from '../models/package.model';
import { PackageType, Provider, Scope } from '../models/provider.model';
import { ApmInstaller } from '../core/installer';

export class ApmInstallerService extends BaseService {
  private _projectRoot: string;
  private _installer: ApmInstaller | null = null;

  constructor({ assistant, logger, projectRoot }: {
    assistant: IIoC;
    logger:    ILogger;
    projectRoot: string;
  }) {
    super({ assistant, logger });
    this._projectRoot = projectRoot;
  }

  private get installer(): ApmInstaller {
    return (this._installer ??= new ApmInstaller(this._projectRoot));
  }

  install(
    packages:  ApmPackage[],
    provider:  Provider,
    scope:     Scope,
    customDir?: string,
  ): OperationResult {
    this.logger?.info({
      src:     'APM:ApmInstallerService:install',
      message: `Installing ${packages.length} package(s) via ${provider}/${scope}`,
    });
    return this.installer.install(packages, provider, scope, customDir);
  }

  uninstall(
    names:      string[],
    type:       PackageType,
    provider:   Provider,
    scope:      Scope,
    customDir?: string,
  ): OperationResult {
    this.logger?.info({
      src:     'APM:ApmInstallerService:uninstall',
      message: `Removing ${names.length} package(s) from ${provider}/${scope}`,
    });
    return this.installer.uninstall(names, type, provider, scope, customDir);
  }
}
