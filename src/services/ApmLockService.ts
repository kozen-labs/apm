import { BaseService } from '@kozen/engine';
import { IIoC } from '@kozen/engine';
import { ILogger } from '@kozen/engine';
import { ApmLock, ApmLockEntry } from '../models/config.model';
import { InstalledPackage } from '../models/package.model';
import { ApmLockManager } from '../core/lock';

export class ApmLockService extends BaseService {
  private _projectRoot: string;
  private _manager: ApmLockManager | null = null;

  constructor({ assistant, logger, projectRoot }: {
    assistant: IIoC;
    logger:    ILogger;
    projectRoot: string;
  }) {
    super({ assistant, logger });
    this._projectRoot = projectRoot;
  }

  private get manager(): ApmLockManager {
    return (this._manager ??= new ApmLockManager(this._projectRoot));
  }

  read(): ApmLock | null                                                     { return this.manager.read(); }
  writeAll(packages: InstalledPackage[]): void                               { this.manager.writeAll(packages); }
  mergeForTarget(packages: InstalledPackage[], provider: string, scope: string): void {
    this.manager.mergeForTarget(packages, provider, scope);
  }
  removeEntries(names: string[], provider: string, scope: string): void {
    this.manager.removeEntries(names, provider, scope);
  }
  getOutdated(): ApmLockEntry[]                                              { return this.manager.getOutdated(); }
}
