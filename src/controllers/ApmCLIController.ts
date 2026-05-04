import fs   from 'fs';
import path from 'path';
import os   from 'os';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { KzController, VCategory } from '@kozen/engine';
import { PackageType, Provider, Scope } from '../models/provider.model';
import { InstalledPackage } from '../models/package.model';
import { findProjectRoot } from '../utils/system';
import { CONFIG_FILENAME } from '../core/config';
import { LOCK_FILENAME }   from '../core/lock';
import * as PluginRegistry from '../core/PluginRegistry';
import * as log from '../utils/log';
import { resolveInstallPath } from '../plugins/providers/path.resolver';
import type { ApmRegistryService }  from '../services/ApmRegistryService';
import type { ApmInstallerService } from '../services/ApmInstallerService';
import type { ApmLockService }      from '../services/ApmLockService';
import type { ApmManifestService }  from '../services/ApmManifestService';
import type { ApmConfigService }    from '../services/ApmConfigService';

const DEFAULT_CACHE_DIR = path.join(os.homedir(), 'apm.cache');

/**
 * ApmCLIController — Kozen CLI entry point for all APM actions.
 *
 * Dispatch via: npx kozen --moduleLoad=@kozen/apm --action=apm:<method>
 *
 * All application logic delegates to IoC-registered services.
 * Display formatting (chalk/console) is controller responsibility.
 *
 * Workarounds active:
 *   KZN-004: --packages=a,b,c replaces positional args (no positional support in Kozen)
 *   KZN-005: projectRoot resolved via process.argv fallback inside register(), then
 *             overridable at controller level via --projectRoot=<path>
 *
 * Renamed flags:
 *   --component  (was --type in the old Commander CLI; default: skill)
 *               Avoids collision with Kozen's --type=cli|mcp runtime selector.
 */
export class ApmCLIController extends KzController {

  // ── helpers ────────────────────────────────────────────────────────────────

  /**
   * Resolve the project root.
   * Priority: --config path dirname > --projectRoot > IoC apm:project-root > auto-detect.
   */
  private async getProjectRoot(): Promise<string> {
    if (this.args?.config) return path.dirname(path.resolve(this.args.config as string));
    if (this.args?.projectRoot) return this.args.projectRoot as string;
    try {
      return await this.assistant?.resolve<string>('apm:project-root') ?? findProjectRoot();
    } catch {
      return findProjectRoot();
    }
  }

  /**
   * Parse --component (default: skill).
   * --component=all expands to [skill, agent].
   */
  private getComponentTypes(): PackageType[] {
    const raw = (this.args?.component ?? 'skill') as string;
    return raw === 'all'
      ? [PackageType.SKILL, PackageType.AGENT]
      : [raw as PackageType];
  }

  /**
   * Parse --packages=name1,name2 into a string array.
   * Workaround for KZN-004: Kozen has no positional arg support.
   */
  private getPackageNames(): string[] {
    const raw = (this.args?.packages ?? '') as string;
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }

  private getProvider(): Provider {
    return (this.args?.provider ?? 'standard') as Provider;
  }

  private getScope(): Scope {
    return (this.args?.scope ?? 'local') as Scope;
  }

  // ── service accessors (lazy IoC resolution, same pattern as ApmMCPController) ──

  private async svcRegistry(): Promise<ApmRegistryService> {
    return this.assistant!.resolve<ApmRegistryService>('apm:registry');
  }

  private async svcInstaller(): Promise<ApmInstallerService> {
    return this.assistant!.resolve<ApmInstallerService>('apm:installer');
  }

  private async svcLock(): Promise<ApmLockService> {
    return this.assistant!.resolve<ApmLockService>('apm:lock');
  }

  private async svcManifest(): Promise<ApmManifestService> {
    return this.assistant!.resolve<ApmManifestService>('apm:manifest');
  }

  private async svcConfig(): Promise<ApmConfigService> {
    return this.assistant!.resolve<ApmConfigService>('apm:config');
  }

  // ── actions ────────────────────────────────────────────────────────────────

  /** npx kozen --action=apm:help */
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
  --component=<skill|agent|all>                Component type  [default: skill]
  --provider=<standard|claude|cursor|vscode|windsurf>  Target provider  [default: standard]
  --scope=<local|global>                       Scope  [default: local]
  --projectRoot=<path>                         Project root (auto-detected if omitted)

Install / Uninstall Options:
  --packages=<name1,name2,...>                 Package names (comma-separated)
  --dir=<path>                                 Custom install directory

Init Options:
  --yes                                        Accept all defaults
  --config=<path>                              Path to apm.pack.json (overrides KOZEN_APM_CONFIG env var)
  --force                                      Overwrite existing apm.pack.json

Refresh Options:
  --source=<name>                              Specific source name to refresh

MCP Server (expose APM as AI tools):
  npx kozen --moduleLoad=@kozen/apm --type=mcp
    `);
  }

  /** npx kozen --action=apm:install [--packages=a,b] [--component=skill] [--provider=claude] [--scope=local] */
  public async install(): Promise<void> {
    const flow      = this.getId(this.args);
    const provider  = this.getProvider();
    const scope     = this.getScope();
    const names     = this.getPackageNames();
    const customDir = this.args?.dir as string | undefined;

    await this.log({
      flow, src: 'APM:ApmCLIController:install',
      message: `Installing via ${provider}/${scope}`,
      category: VCategory.cli.tool,
    });

    const registry  = await this.svcRegistry();
    const installer = await this.svcInstaller();
    const lock      = await this.svcLock();

    for (const type of this.getComponentTypes()) {
      const available = registry.getAvailable(type);
      const toInstall = names.length
        ? available.filter(p => names.includes(p.name))
        : available;

      const missing = names.filter(n => !available.find(p => p.name === n));
      for (const m of missing) log.warn(`${type} not found in source registry: ${m}`);

      if (!toInstall.length) {
        log.error(`No matching ${type}s found. Run 'apm list --component ${type}' to see available packages.`);
        process.exit(1);
      }

      log.section(`Installing ${toInstall.length} ${type}(s)`);
      const result = installer.install(toInstall, provider, scope, customDir);

      if (result.succeeded.length) {
        try {
          const installed = registry.getInstalled(type)
            .filter(p => p.provider === provider && p.scope === scope);
          lock.mergeForTarget(installed, provider, scope);
        } catch { /* lock update is best-effort */ }
      }
    }
  }

  /** npx kozen --action=apm:uninstall [--packages=a,b] [--component=skill] [--provider=claude] [--scope=local] */
  public async uninstall(): Promise<void> {
    const flow      = this.getId(this.args);
    const provider  = this.getProvider();
    const scope     = this.getScope();
    const names     = this.getPackageNames();
    const customDir = this.args?.dir as string | undefined;

    await this.log({
      flow, src: 'APM:ApmCLIController:uninstall',
      message: `Removing from ${provider}/${scope}`,
      category: VCategory.cli.tool,
    });

    const registry  = await this.svcRegistry();
    const installer = await this.svcInstaller();
    const lock      = await this.svcLock();

    for (const type of this.getComponentTypes()) {
      let toRemove = names;

      if (!toRemove.length) {
        toRemove = registry.getInstalled(type)
          .filter(p => p.provider === provider && p.scope === scope)
          .map(p => p.name);

        if (!toRemove.length) {
          log.info(`Nothing installed at ${provider}/${scope}.`);
          continue;
        }
      }

      log.section(`Uninstalling ${toRemove.length} ${type}(s)`);
      const result = installer.uninstall(toRemove, type, provider, scope, customDir);

      if (result.succeeded.length) {
        try {
          lock.removeEntries(result.succeeded, provider, scope);
        } catch { /* lock update is best-effort */ }
      }
    }
  }

  /** npx kozen --action=apm:list [--component=skill|agent|all] */
  public async list(): Promise<void> {
    const registry = await this.svcRegistry();
    const types    = (this.args?.component ?? 'skill') === 'all'
      ? [PackageType.SKILL, PackageType.AGENT]
      : [(this.args?.component ?? 'skill') as PackageType];

    for (const type of types) {
      const packages = registry.getAvailable(type);
      log.section(`Available ${type}s  (${packages.length} total)`);

      const groups = groupBy(packages, p => p.group);
      for (const [group, members] of Object.entries(groups).sort()) {
        console.log(`\n  ${chalk.bold(group)}  (${members.length})`);
        for (const p of members) {
          const upd   = p.updated ? `  ${chalk.dim(`updated ${p.updated}`)}` : '';
          const desc  = p.description.replace(/\n/g, ' ').slice(0, 80);
          const trail = desc.length >= 80 ? '…' : '';
          console.log(`    ${chalk.cyan(p.name.padEnd(48))}${upd}`);
          if (desc) console.log(`      ${chalk.dim(desc + trail)}`);
        }
      }
    }
    console.log();
  }

  /** npx kozen --action=apm:status [--component=skill|agent|all] */
  public async status(): Promise<void> {
    const registry = await this.svcRegistry();
    const lock     = await this.svcLock();
    const types    = (this.args?.component ?? 'skill') === 'all'
      ? [PackageType.SKILL, PackageType.AGENT]
      : [(this.args?.component ?? 'skill') as PackageType];

    const allInstalled: InstalledPackage[] = [];

    for (const type of types) {
      const installed = registry.getInstalled(type);
      allInstalled.push(...installed);

      if (!installed.length) {
        log.info(`No ${type}s installed in any known provider location.`);
        console.log();
        continue;
      }

      const groups = groupBy(installed, p => `${p.provider}/${p.scope}`);
      log.section(`Installed ${type}s  (${installed.length} total)`);

      for (const [key, members] of Object.entries(groups).sort()) {
        const [provider, scope] = key.split('/') as [Provider, Scope];
        const installPath = resolveInstallPath(
          provider, scope, await this.getProjectRoot(),
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

    if (allInstalled.length) {
      lock.writeAll(allInstalled);
      log.detail('Lock written: apm.lock.json');
    }
  }

  /** npx kozen --action=apm:outdated [--component=skill|agent|all] */
  public async outdated(): Promise<void> {
    const registry = await this.svcRegistry();
    const lock     = await this.svcLock();
    const types    = (this.args?.component ?? 'skill') === 'all'
      ? [PackageType.SKILL, PackageType.AGENT]
      : [(this.args?.component ?? 'skill') as PackageType];

    let foundAny = false;
    const allInstalled: InstalledPackage[] = [];

    for (const type of types) {
      const installed = registry.getInstalled(type);
      allInstalled.push(...installed);

      const stale = installed.filter(p => p.isOutdated);
      if (!stale.length) continue;

      foundAny = true;
      log.section(`Outdated ${type}s  (${stale.length})`);
      const namePad = 48;
      const datePad = 14;
      console.log(`  ${'Package'.padEnd(namePad)} ${'Installed'.padEnd(datePad)} Latest`);
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

    if (allInstalled.length) {
      lock.writeAll(allInstalled);
      log.detail('Lock written: apm.lock.json');
    }
  }

  /** npx kozen --action=apm:setup [--yes] [--force] [--config=<path>] */
  public async setup(): Promise<void> {
    log.section('APM — Initialize project');

    const configPath  = this.args?.config as string | undefined;
    const projectRoot = await this.getProjectRoot();
    const configSvc   = await this.svcConfig();
    const lockSvc     = await this.svcLock();

    // ── apm.pack.json ───────────────────────────────────────────────────────

    const configExists = configSvc.read() !== null;
    const force        = Boolean(this.args?.force);

    if (configExists && !force) {
      log.skip(`${CONFIG_FILENAME} already exists  (use --force to overwrite)`);
    } else {
      const provider = this.args?.yes
        ? 'standard'
        : (await inquirer.prompt<{ provider: string }>([{
            type:    'list',
            name:    'provider',
            message: 'Default provider:',
            choices: ['standard', 'claude', 'cursor', 'vscode', 'windsurf'],
            default: 'standard',
          }])).provider;

      const scope = this.args?.yes
        ? 'global'
        : (await inquirer.prompt<{ scope: string }>([{
            type:    'list',
            name:    'scope',
            message: 'Default scope:',
            choices: ['global', 'local'],
            default: 'global',
          }])).scope;

      const enableCommunity = this.args?.yes
        ? false
        : (await inquirer.prompt<{ enable: boolean }>([{
            type:    'confirm',
            name:    'enable',
            message: `Enable community skill sources? (can be done later by editing ${CONFIG_FILENAME})`,
            default: false,
          }])).enable;

      const config = configSvc.getOrCreate();
      config.defaultProvider = provider;
      config.defaultScope    = scope;

      if (enableCommunity) {
        for (const s of config.sources) {
          if (s.type === 'github') s.enabled = true;
        }
      }

      configSvc.write(config);
      const writtenPath = configPath
        ?? process.env.KOZEN_APM_CONFIG
        ?? path.join(projectRoot, CONFIG_FILENAME);
      log.ok(`${CONFIG_FILENAME} written  (${writtenPath})`);

      if (enableCommunity) {
        log.detail('Community sources enabled. Run `apm refresh` to clone them.');
      }
    }

    // ── apm.lock.json ────────────────────────────────────────────────────────

    const lockExists = lockSvc.read() !== null;
    if (lockExists && !force) {
      log.skip(`${LOCK_FILENAME} already exists`);
    } else {
      lockSvc.writeAll([]);
      log.ok(`${LOCK_FILENAME} written  (empty — run \`apm status\` to populate)`);
    }

    // ── .agents/apm.json manifest ─────────────────────────────────────────────

    if (fs.existsSync(path.join(projectRoot, '.agents'))) {
      const manifestSvc  = await this.svcManifest();
      const manifest     = manifestSvc.writeGenerated();
      const { skills, agents } = manifest.packages;
      log.ok(`.agents/apm.json written — ${skills.length} skills, ${agents.length} agents`);
    }

    console.log();
    log.detail(`Edit ${CONFIG_FILENAME} to add or enable sources, then run \`apm list\` to see available packages.`);
    console.log();
  }

  /** npx kozen --action=apm:manifest */
  public async manifest(): Promise<void> {
    log.section('Generating .agents/apm.json');
    const manifestSvc        = await this.svcManifest();
    const manifest           = manifestSvc.writeGenerated();
    const { skills, agents } = manifest.packages;
    log.ok(`apm.json written — ${skills.length} skills, ${agents.length} agents`);
    console.log();
  }

  /** npx kozen --action=apm:refresh [--source=name] */
  public async refresh(): Promise<void> {
    const configSvc  = await this.svcConfig();
    const sourceName = this.args?.source as string | undefined;
    const allSources = configSvc.getAllSources();
    const targets    = sourceName
      ? allSources.filter(s => s.name === sourceName)
      : allSources.filter(s => s.type !== 'local');

    if (sourceName && targets.length === 0) {
      log.error(`Source "${sourceName}" not found in apm.pack.json`);
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
}

// ── module-private helper ──────────────────────────────────────────────────

function groupBy<T>(items: T[], keyFn: (i: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    (acc[keyFn(item)] ??= []).push(item);
    return acc;
  }, {});
}
