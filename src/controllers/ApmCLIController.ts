import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { KzController, VCategory } from '@kozen/engine';
import { PackageType, Provider, Scope } from '../models/provider.model';
import { InstalledPackage } from '../models/package.model';
import { findProjectRoot } from '../utils/system';
import * as log from '../utils/log';
import { resolveInstallPath } from '../plugins/providers/path.resolver';
import type { IComponentPlugin } from '../plugins/components/IComponentPlugin';

/**
 * ApmCLIController — thin dispatcher. Resolves the component plugin for the
 * requested --component type and delegates every action to it.
 *
 * Dispatch: npx kozen --moduleLoad=@kozen/apm --action=apm:<method>
 *
 * Workarounds:
 *   KZN-004: --packages=a,b,c replaces positional args
 *   KZN-005: projectRoot auto-detected; overridable via --projectRoot / --config
 *
 * Renamed flag: --component (was --type; avoids collision with Kozen's --type=cli|mcp)
 */
export class ApmCLIController extends KzController {

  // ── arg helpers ────────────────────────────────────────────────────────────

  private async getProjectRoot(): Promise<string> {
    if (this.args?.config) return path.dirname(path.resolve(this.args.config as string));
    if (this.args?.projectRoot) return this.args.projectRoot as string;
    try {
      return await this.assistant?.resolve<string>('apm:project-root') ?? findProjectRoot();
    } catch {
      return findProjectRoot();
    }
  }

  private getComponentType(): PackageType {
    return ((this.args?.component ?? 'skill') as string) as PackageType;
  }

  private getComponentTypes(): PackageType[] {
    const raw = (this.args?.component ?? 'skill') as string;
    return raw === 'all'
      ? [PackageType.SKILL, PackageType.AGENT]
      : [raw as PackageType];
  }

  private getPackageNames(): string[] {
    return ((this.args?.packages ?? '') as string)
      .split(',').map(s => s.trim()).filter(Boolean);
  }

  private getProvider(): Provider { return (this.args?.provider ?? 'standard') as Provider; }
  private getScope():    Scope    { return (this.args?.scope    ?? 'local')    as Scope;    }

  // ── plugin resolution ──────────────────────────────────────────────────────

  private async plugin(type: PackageType): Promise<IComponentPlugin> {
    return this.assistant!.resolve<IComponentPlugin>(`apm:plugin:component:${type}`);
  }

  // ── actions ────────────────────────────────────────────────────────────────

  public async help(): Promise<void> {
    console.log(`
@kozen/apm — Agent Package Manager

Usage:
  npx kozen --moduleLoad=@kozen/apm --action=apm:<action> [options]

Actions:
  help        Show this help message
  install     Install packages from the source registry
  uninstall   Remove installed packages
  list        List available packages from sources
  status      Show all installed packages (highlights outdated)
  outdated    Show packages with newer versions available
  setup       Initialize project (create apm.pack.json + apm.lock.json)
  manifest    Scan source directories and write .agents/apm.json
  refresh     Pull latest from remote sources (github, npm)

Common Options:
  --component=<skill|agent|all>                          Component type  [default: skill]
  --provider=<standard|claude|cursor|vscode|windsurf>    Target provider [default: standard]
  --scope=<local|global>                                 Scope           [default: local]
  --projectRoot=<path>                                   Project root (auto-detected if omitted)

Install / Uninstall Options:
  --packages=<name1,name2,...>   Package names (comma-separated; omit to install/remove all)
  --dir=<path>                   Custom install directory

Setup Options:
  --yes                          Accept all defaults without prompts
  --config=<path>                Path to apm.pack.json (overrides KOZEN_APM_CONFIG env var)
  --force                        Overwrite existing apm.pack.json / apm.lock.json

Refresh Options:
  --source=<name>                Specific source name to refresh

MCP Server:
  npx kozen --moduleLoad=@kozen/apm --type=mcp
    `);
  }

  public async install(): Promise<void> {
    const flow        = this.getId(this.args);
    const projectRoot = await this.getProjectRoot();
    const provider    = this.getProvider();
    const scope       = this.getScope();
    const names       = this.getPackageNames();
    const customDir   = this.args?.dir as string | undefined;

    await this.log({
      flow, src: 'APM:ApmCLIController:install',
      message: `Installing via ${provider}/${scope}`,
      category: VCategory.cli.tool,
    });

    for (const type of this.getComponentTypes()) {
      const p = await this.plugin(type);
      p.install({ projectRoot, provider, scope, names, customDir });
    }
  }

  public async uninstall(): Promise<void> {
    const flow        = this.getId(this.args);
    const projectRoot = await this.getProjectRoot();
    const provider    = this.getProvider();
    const scope       = this.getScope();
    const names       = this.getPackageNames();
    const customDir   = this.args?.dir as string | undefined;

    await this.log({
      flow, src: 'APM:ApmCLIController:uninstall',
      message: `Removing from ${provider}/${scope}`,
      category: VCategory.cli.tool,
    });

    for (const type of this.getComponentTypes()) {
      const p = await this.plugin(type);
      p.uninstall({ projectRoot, provider, scope, names, customDir });
    }
  }

  public async list(): Promise<void> {
    const projectRoot = await this.getProjectRoot();

    for (const type of this.getComponentTypes()) {
      const p        = await this.plugin(type);
      const packages = p.list({ projectRoot });

      log.section(`Available ${type}s  (${packages.length} total)`);
      for (const [group, members] of Object.entries(groupBy(packages, p => p.group)).sort()) {
        console.log(`\n  ${chalk.bold(group)}  (${members.length})`);
        for (const pkg of members) {
          const upd   = pkg.updated ? `  ${chalk.dim(`updated ${pkg.updated}`)}` : '';
          const desc  = pkg.description.replace(/\n/g, ' ').slice(0, 80);
          const trail = desc.length >= 80 ? '…' : '';
          console.log(`    ${chalk.cyan(pkg.name.padEnd(48))}${upd}`);
          if (desc) console.log(`      ${chalk.dim(desc + trail)}`);
        }
      }
    }
    console.log();
  }

  public async status(): Promise<void> {
    const projectRoot  = await this.getProjectRoot();
    const allInstalled: InstalledPackage[] = [];

    for (const type of this.getComponentTypes()) {
      const p         = await this.plugin(type);
      const installed = p.status({ projectRoot });
      allInstalled.push(...installed);

      if (!installed.length) {
        log.info(`No ${type}s installed in any known provider location.`);
        console.log();
        continue;
      }

      log.section(`Installed ${type}s  (${installed.length} total)`);
      for (const [key, members] of Object.entries(groupBy(installed, p => `${p.provider}/${p.scope}`)).sort()) {
        const [provider, scope] = key.split('/') as [Provider, Scope];
        const installPath = resolveInstallPath(
          provider, scope, projectRoot,
          type === PackageType.AGENT ? 'agent' : 'skill',
        );
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

    if (allInstalled.length) log.detail('Lock written: apm.lock.json');
  }

  public async outdated(): Promise<void> {
    const projectRoot  = await this.getProjectRoot();
    let   foundAny     = false;
    const allInstalled: InstalledPackage[] = [];

    for (const type of this.getComponentTypes()) {
      const p     = await this.plugin(type);
      const stale = p.outdated({ projectRoot });
      allInstalled.push(...stale);
      if (!stale.length) continue;

      foundAny = true;
      log.section(`Outdated ${type}s  (${stale.length})`);
      const namePad = 48;
      const datePad = 14;
      console.log(`  ${'Package'.padEnd(namePad)} ${'Installed'.padEnd(datePad)} Latest`);
      console.log(`  ${'─'.repeat(namePad)} ${'─'.repeat(datePad)} ${'─'.repeat(datePad)}`);
      for (const pkg of stale.sort((a, b) => a.name.localeCompare(b.name))) {
        console.log(
          `  ${chalk.yellow(pkg.name.padEnd(namePad))} ` +
          `${chalk.dim(pkg.updated.padEnd(datePad))} ` +
          chalk.green(pkg.sourceUpdated),
        );
      }
      console.log();
    }

    if (!foundAny) { log.ok('All installed packages are up to date.'); console.log(); }
    if (allInstalled.length) log.detail('Lock written: apm.lock.json');
  }

  /** Interactive prompts are controller responsibility; resolved values delegate to plugin. */
  public async setup(): Promise<void> {
    const projectRoot = await this.getProjectRoot();
    const configPath  = this.args?.config as string | undefined;
    const force       = Boolean(this.args?.force);
    const p           = await this.plugin(PackageType.SKILL); // project-level op, any plugin works

    const provider = this.args?.yes
      ? 'standard'
      : (await inquirer.prompt<{ provider: string }>([{
          type: 'list', name: 'provider', message: 'Default provider:',
          choices: ['standard', 'claude', 'cursor', 'vscode', 'windsurf'], default: 'standard',
        }])).provider;

    const scope = this.args?.yes
      ? 'global'
      : (await inquirer.prompt<{ scope: string }>([{
          type: 'list', name: 'scope', message: 'Default scope:',
          choices: ['global', 'local'], default: 'global',
        }])).scope;

    const enableCommunity = this.args?.yes
      ? false
      : (await inquirer.prompt<{ enable: boolean }>([{
          type: 'confirm', name: 'enable',
          message: 'Enable community skill sources? (can be done later by editing apm.pack.json)',
          default: false,
        }])).enable;

    p.setup({ projectRoot, provider, scope, enableCommunity, force, configPath });
  }

  public async manifest(): Promise<void> {
    const projectRoot = await this.getProjectRoot();
    const p           = await this.plugin(this.getComponentType());
    log.section('Generating .agents/apm.json');
    const manifest           = p.manifest({ projectRoot });
    const { skills, agents } = manifest.packages;
    log.ok(`apm.json written — ${skills.length} skills, ${agents.length} agents`);
    console.log();
  }

  public async refresh(): Promise<void> {
    const projectRoot = await this.getProjectRoot();
    const p           = await this.plugin(this.getComponentType());
    p.refresh({ projectRoot, sourceName: this.args?.source as string | undefined });
  }
}

function groupBy<T>(items: T[], keyFn: (i: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    (acc[keyFn(item)] ??= []).push(item);
    return acc;
  }, {});
}
