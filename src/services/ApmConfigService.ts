import { BaseService } from '@kozen/engine';
import { IIoC } from '@kozen/engine';
import { ILogger } from '@kozen/engine';
import { ApmConfig, ApmSource } from '../models/config.model';
import { ApmConfigManager } from '../core/config';

export class ApmConfigService extends BaseService {
  private _projectRoot: string;
  private _manager: ApmConfigManager | null = null;

  constructor({ assistant, logger, projectRoot }: {
    assistant: IIoC;
    logger:    ILogger;
    projectRoot: string;
  }) {
    super({ assistant, logger });
    this._projectRoot = projectRoot;
  }

  private get manager(): ApmConfigManager {
    return (this._manager ??= new ApmConfigManager(this._projectRoot));
  }

  read(): ApmConfig | null                  { return this.manager.read(); }
  write(config: ApmConfig): void            { this.manager.write(config); }
  getOrCreate(): ApmConfig                  { return this.manager.getOrCreate(); }
  getPrimarySourceRoot(): string            { return this.manager.getPrimarySourceRoot(); }
  getLocalSourceRoots(): string[]           { return this.manager.getLocalSourceRoots(); }
  getEnabledSources(): ApmSource[]          { return this.manager.getEnabledSources(); }
  getAllSources(): ApmSource[]               { return this.manager.getAllSources(); }
}
