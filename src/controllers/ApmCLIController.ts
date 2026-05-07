import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { KzController, IArgs, VCategory } from '@kozen/engine';
import { PackageType } from '../models/PackageType';
import { Provider } from '../models/Provider';
import { Scope } from '../models/Scope';
import type { IInstalledPackage } from '../models/IInstalledPackage';
import { findProjectRoot } from '../utils/system';
import { resolveInstallPath } from '../utils/path.resolver';
import * as log from '../utils/log';
import type { IComponent } from '../models/IComponent';

/**
 * ApmCLIController — thin dispatcher that resolves the IComponent plugin for the
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

  /**
   * Apply KOZEN_APM_* env-var fallbacks and argument defaults before dispatch.
   * Priority: CLI flag → env var → hardcoded default.
   */
  public async fill(args: string[] | IArgs): Promise<IArgs> {
    const parsed = await super.fill(args);
    parsed['component'] = parsed['component'] || process.env.KOZEN_APM_COMPONENT || 'skill';
    parsed['provider']  = parsed['provider']  || process.env.KOZEN_APM_PROVIDER  || 'standard';
    parsed['scope']     = parsed['scope']      || process.env.KOZEN_APM_SCOPE     || 'local';
    parsed['config']    = parsed['config']     || process.env.KOZEN_APM_CONFIG;
    return parsed;
  }

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
    return (this.args?.component as string) as PackageType;
  }

  private getComponentTypes(): PackageType[] {
    const raw = this.args?.component as string;
    return raw === 'all'
      ? [PackageType.SKILL, PackageType.AGENT]
      : [raw as PackageType];
  }

  private getPackageNames(): string[] {
    return ((this.args?.packages ?? '') as string)
      .split(',').map(s => s.trim()).filter(Boolean);
  }

  private getProvider(): Provider { return this.args?.provider as Provider; }
  private getScope():    Scope    { return this.args?.scope    as Scope;    }

  // ── plugin resolution ──────────────────────────────────────────────────────

  private async plugin(type: PackageType): Promise<IComponent> {
    return this.assistant!.resolve<IComponent>(`apm:plugin:component:${type}`);
  }

  // ── actions ────────────────────────────────────────────────────────────────

  /**
   * Displays help from src/docs/apm.txt via the FileService.
   */
  public async help(): Promise<void> {
    const content = await this.srvFile?.select('apm');
    console.log(content ?? '@kozen/apm — run with --action=apm:help for usage.');
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
      await p.install({ projectRoot, provider, scope, names, customDir });
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
      await p.uninstall({ projectRoot, provider, scope, names, customDir });
    }
  }

  public async list(): Promise<void> {
    const projectRoot = await this.getProjectRoot();

    for (const type of this.getComponentTypes()) {
      const p        = await this.plugin(type);
      const packages = await p.list({ projectRoot });

      log.section(`Available ${type}s  (${packages.length} total)`);
      for (const [group, members] of Object.entries(groupBy(packages, pkg => pkg.group)).sort()) {
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
    const allInstalled: IInstalledPackage[] = [];

    for (const type of this.getComponentTypes()) {
      const p         = await this.plugin(type);
      const installed = await p.status({ projectRoot });
      allInstalled.push(...installed);

      if (!installed.length) {
        log.info(`No ${type}s installed in any known provider location.`);
        console.log();
        continue;
      }

      log.section(`Installed ${type}s  (${installed.length} total)`);
      for (const [key, members] of Object.entries(groupBy(installed, pkg => `${pkg.provider}/${pkg.scope}`)).sort()) {
        const [provider, scope] = key.split('/') as [Provider, Scope];
        const installPath = resolveInstallPath(provider, scope, projectRoot, type === PackageType.AGENT ? 'agent' : 'skill');
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
    const allInstalled: IInstalledPackage[] = [];

    for (const type of this.getComponentTypes()) {
      const p     = await this.plugin(type);
      const stale = await p.outdated({ projectRoot });
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

  /**
   * Interactive prompts own provider/scope/community-sources selection;
   * resolved values are delegated to the plugin.
   */
  public async setup(): Promise<void> {
    const projectRoot = await this.getProjectRoot();
    const configPath  = this.args?.config as string | undefined;
    const force       = Boolean(this.args?.force);
    const p           = await this.plugin(PackageType.SKILL);

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

    await p.setup({ projectRoot, provider, scope, enableCommunity, force, configPath });
  }

  public async manifest(): Promise<void> {
    const projectRoot = await this.getProjectRoot();
    const p           = await this.plugin(this.getComponentType());
    log.section('Generating .agents/apm.json');
    const manifest           = await p.manifest({ projectRoot });
    const { skills, agents } = manifest.packages;
    log.ok(`apm.json written — ${skills.length} skills, ${agents.length} agents`);
    console.log();
  }

  public async refresh(): Promise<void> {
    const projectRoot = await this.getProjectRoot();
    const p           = await this.plugin(this.getComponentType());
    await p.refresh({ projectRoot, sourceName: this.args?.source as string | undefined });
  }

}

function groupBy<T>(items: T[], keyFn: (i: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    (acc[keyFn(item)] ??= []).push(item);
    return acc;
  }, {});
}
