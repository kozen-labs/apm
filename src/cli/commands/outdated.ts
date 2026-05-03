import chalk from 'chalk';
import { ApmRegistry } from '../../core/registry';
import { ApmLockManager } from '../../core/lock';
import { InstalledPackage } from '../../models/package.model';
import { PackageType } from '../../models/provider.model';
import * as log from '../../utils/log';

export function outdatedCommand(projectRoot: string, type: PackageType | 'all'): void {
  const registry = new ApmRegistry(projectRoot);
  const lock     = new ApmLockManager(projectRoot);
  const types    = type === 'all'
    ? [PackageType.SKILL, PackageType.AGENT]
    : [type as PackageType];

  let foundAny = false;
  const allInstalled: InstalledPackage[] = [];

  for (const t of types) {
    const installed = registry.getInstalled(t);
    allInstalled.push(...installed);

    const stale = installed.filter(p => p.isOutdated);
    if (!stale.length) continue;

    foundAny = true;
    log.section(`Outdated ${t}s  (${stale.length})`);
    const namePad = 48;
    const datePad = 14;
    console.log(
      `  ${'Package'.padEnd(namePad)} ${'Installed'.padEnd(datePad)} Latest`,
    );
    console.log(`  ${'─'.repeat(namePad)} ${'─'.repeat(datePad)} ${'─'.repeat(datePad)}`);

    for (const p of stale.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(
        `  ${chalk.yellow(p.name.padEnd(namePad))} ` +
        `${chalk.dim(p.updated.padEnd(datePad))} ` +
        chalk.green(p.sourceUpdated),
      );
    }
    console.log();
  }

  if (!foundAny) {
    log.ok('All installed packages are up to date.');
    console.log();
  }

  // Persist the full snapshot so the lock always reflects the latest scan.
  if (allInstalled.length) {
    lock.writeAll(allInstalled);
    log.detail(`Lock written: apm.lock.json`);
  }
}
