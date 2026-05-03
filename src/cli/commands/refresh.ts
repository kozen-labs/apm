import * as PluginRegistry from '../../core/PluginRegistry';
import { ApmConfigManager } from '../../core/config';
import * as log from '../../utils/log';
import os from 'os';
import path from 'path';

const DEFAULT_CACHE_DIR = path.join(os.homedir(), 'apm.cache');

export function refreshCommand(projectRoot: string, sourceName?: string): void {
  const configManager = new ApmConfigManager(projectRoot);
  const allSources    = configManager.getAllSources();
  const targets       = sourceName
    ? allSources.filter(s => s.name === sourceName)
    : allSources.filter(s => s.type !== 'local');

  if (sourceName && targets.length === 0) {
    log.error(`Source "${sourceName}" not found in apm.config.json`);
    process.exit(1);
  }

  if (targets.length === 0) {
    log.info('No remote sources configured. Nothing to refresh.');
    return;
  }

  for (const source of targets) {
    if (!PluginRegistry.hasRepository(source.type)) {
      log.warn(`No strategy registered for source type "${source.type}" — skipping "${source.name}"`);
      continue;
    }
    const strategy = PluginRegistry.getRepository(source.type);
    log.info(`Refreshing "${source.name}" (${source.url ?? source.path ?? source.type})…`);
    try {
      strategy.refresh(source, DEFAULT_CACHE_DIR);
      log.ok(source.name);
    } catch (err) {
      log.error(`${source.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log();
}
