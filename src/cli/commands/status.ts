import chalk from 'chalk';
import { ApmRegistry } from '../../core/registry';
import { ApmLockManager } from '../../core/lock';
import { InstalledPackage } from '../../models/package.model';
import { PackageType, Provider, Scope } from '../../models/provider.model';
import { resolveInstallPath } from '../../providers/path.resolver';
import * as log from '../../utils/log';

export function statusCommand(projectRoot: string, type: PackageType | 'all'): void {
  const registry = new ApmRegistry(projectRoot);
  const lock     = new ApmLockManager(projectRoot);
  const types    = type === 'all'
    ? [PackageType.SKILL, PackageType.AGENT]
    : [type as PackageType];

  const allInstalled: InstalledPackage[] = [];

  for (const t of types) {
    const installed = registry.getInstalled(t);
    allInstalled.push(...installed);

    if (!installed.length) {
      log.info(`No ${t}s installed in any known provider location.`);
      console.log();
      continue;
    }

    const groups = groupBy(installed, p => `${p.provider}/${p.scope}`);
    log.section(`Installed ${t}s  (${installed.length} total)`);

    for (const [key, members] of Object.entries(groups).sort()) {
      const [provider, scope] = key.split('/') as [Provider, Scope];
      const installPath = resolveInstallPath(provider, scope, projectRoot,
        t === PackageType.AGENT ? 'agent' : 'skill');
      console.log(`\n  ${chalk.bold(provider.toUpperCase())} / ${scope}  →  ${chalk.dim(installPath)}`);

      for (const pkg of members.sort((a, b) => a.name.localeCompare(b.name))) {
        const upd      = pkg.updated ? `  ${chalk.dim(`updated ${pkg.updated}`)}` : '';
        const outdated = pkg.isOutdated ? `  ${chalk.yellow('↑ update available')}` : '';
        const icon     = pkg.isOutdated ? chalk.yellow('!') : chalk.green('✓');
        console.log(`    ${icon}  ${pkg.name}${upd}${outdated}`);
      }
    }
    console.log();
  }

  // Persist the full snapshot to apm.lock.json.
  if (allInstalled.length) {
    lock.writeAll(allInstalled);
    log.detail(`Lock written: apm.lock.json`);
  }
}

function groupBy<T>(items: T[], keyFn: (i: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    (acc[keyFn(item)] ??= []).push(item);
    return acc;
  }, {});
}
