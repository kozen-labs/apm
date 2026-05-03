import { BaseService } from '@kozen/engine';
import { IIoC } from '@kozen/engine';
import { ILogger } from '@kozen/engine';
import { ApmManifest } from '../models/package.model';
import { ApmManifestManager } from '../core/manifest';
import { ApmConfigManager } from '../core/config';

export class ApmManifestService extends BaseService {
  private _projectRoot: string;
  private _manager: ApmManifestManager | null = null;

  constructor({ assistant, logger, projectRoot }: {
    assistant: IIoC;
    logger:    ILogger;
    projectRoot: string;
  }) {
    super({ assistant, logger });
    this._projectRoot = projectRoot;
  }

  private get manager(): ApmManifestManager {
    if (!this._manager) {
      const sourceRoot  = new ApmConfigManager(this._projectRoot).getPrimarySourceRoot();
      this._manager     = new ApmManifestManager(sourceRoot);
    }
    return this._manager;
  }

  read(): ApmManifest | null     { return this.manager.read(); }
  generate(): ApmManifest        { return this.manager.generate(); }

  writeGenerated(): ApmManifest {
    this.logger?.info({
      src:     'APM:ApmManifestService:writeGenerated',
      message: 'Regenerating apm.json manifest',
    });
    const manifest = this.manager.generate();
    this.manager.write(manifest);
    return manifest;
  }
}
