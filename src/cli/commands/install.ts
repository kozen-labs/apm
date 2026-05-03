import { ApmRegistry } from '../../core/registry';
import { ApmInstaller } from '../../core/installer';
import { ApmLockManager } from '../../core/lock';
import { PackageType, Provider, Scope } from '../../models/provider.model';
import * as log from '../../utils/log';

export function installCommand(
  names: string[],
  type: PackageType,
  provider: Provider,
  scope: Scope,
  projectRoot: string,
  customDir?: string,
): void {
  const registry  = new ApmRegistry(projectRoot);
  const available = registry.getAvailable(type);

  const toInstall = names.length
    ? available.filter(p => names.includes(p.name))
    : available;

  const missing = names.filter(n => !available.find(p => p.name === n));
  for (const m of missing) log.warn(`${type} not found in source registry: ${m}`);

  if (!toInstall.length) {
    log.error(`No matching ${type}s found. Run 'apm list --type ${type}' to see available packages.`);
    process.exit(1);
  }

  log.section(`Installing ${toInstall.length} ${type}(s)`);
  const installer = new ApmInstaller(projectRoot);
  const result    = installer.install(toInstall, provider, scope, customDir);

  // Update apm.lock.json with the fresh state for this provider+scope.
  if (result.succeeded.length) {
    try {
      const installed = registry.getInstalled(type)
        .filter(p => p.provider === provider && p.scope === scope);
      new ApmLockManager(projectRoot).mergeForTarget(installed, provider, scope);
    } catch {
      // Lock update is best-effort — don't fail the install.
    }
  }
}
