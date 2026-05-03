import { BaseService } from '@kozen/engine';
import { IIoC } from '@kozen/engine';
import { ILogger } from '@kozen/engine';
import { ApmPackage, InstalledPackage } from '../models/package.model';
import { PackageType } from '../models/provider.model';
import { ApmRegistry } from '../core/registry';

export class ApmRegistryService extends BaseService {
  private _projectRoot: string;
  private _registry: ApmRegistry | null = null;

  constructor({ assistant, logger, projectRoot }: {
    assistant: IIoC;
    logger:    ILogger;
    projectRoot: string;
  }) {
    super({ assistant, logger });
    this._projectRoot = projectRoot;
  }

  private get registry(): ApmRegistry {
    return (this._registry ??= new ApmRegistry(this._projectRoot));
  }

  getAvailable(type: PackageType = PackageType.SKILL): ApmPackage[] {
    this.logger?.info({
      src: 'APM:ApmRegistryService:getAvailable',
      message: `Listing available ${type}s`,
    });
    return this.registry.getAvailable(type);
  }

  getInstalled(type: PackageType = PackageType.SKILL): InstalledPackage[] {
    return this.registry.getInstalled(type);
  }
}
