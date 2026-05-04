import chalk from 'chalk';
import { ApmRegistry } from './registry';
import { ApmPackage } from '../models/package.model';
import { PackageType } from '../models/provider.model';
import * as log from '../utils/log';

export function listCommand(projectRoot: string, type: PackageType | 'all'): void {
  const registry = new ApmRegistry(projectRoot);
  const types = type === 'all'
    ? [PackageType.SKILL, PackageType.AGENT]
    : [type as PackageType];

  for (const t of types) {
    const packages = registry.getAvailable(t);
    log.section(`Available ${t}s  (${packages.length} total)`);

    const groups = groupBy(packages, p => p.group);
    for (const [group, members] of Object.entries(groups).sort()) {
      console.log(`\n  ${chalk.bold(group)}  (${members.length})`);
      for (const p of members) {
        const upd  = p.updated ? `  ${chalk.dim(`updated ${p.updated}`)}` : '';
        const desc = p.description.replace(/\n/g, ' ').slice(0, 80);
        const trail = desc.length >= 80 ? '…' : '';
        console.log(`    ${chalk.cyan(p.name.padEnd(48))}${upd}`);
        if (desc) console.log(`      ${chalk.dim(desc + trail)}`);
      }
    }
  }
  console.log();
}

function groupBy<T>(items: T[], keyFn: (i: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    (acc[keyFn(item)] ??= []).push(item);
    return acc;
  }, {});
}
