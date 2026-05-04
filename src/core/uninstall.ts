import { ApmRegistry } from './registry';
import { ApmInstaller } from './installer';
import { ApmLockManager } from './lock';
import { PackageType, Provider, Scope } from '../models/provider.model';
import * as log from '../utils/log';

export function uninstallCommand(
  names: string[],
  type: PackageType,
  provider: Provider,
  scope: Scope,
  projectRoot: string,
  customDir?: string,
): void {
  let toRemove = names;

  if (!toRemove.length) {
    const registry  = new ApmRegistry(projectRoot);
    const installed = registry.getInstalled(type)
      .filter(p => p.provider === provider && p.scope === scope);
    toRemove = installed.map(p => p.name);

    if (!toRemove.length) {
      log.info(`Nothing installed at ${provider}/${scope}.`);
      return;
    }
  }

  log.section(`Uninstalling ${toRemove.length} ${type}(s)`);
  const installer = new ApmInstaller(projectRoot);
  const result    = installer.uninstall(toRemove, type, provider, scope, customDir);

  if (result.succeeded.length) {
    try {
      new ApmLockManager(projectRoot).removeEntries(result.succeeded, provider, scope);
    } catch {
      // Lock update is best-effort.
    }
  }
}
