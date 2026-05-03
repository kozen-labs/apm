import { KzController, VCategory } from '@kozen/engine';
import { PackageType, Provider, Scope } from '../models/provider.model';
import { findProjectRoot } from '../platform/system';
import { installCommand }   from '../cli/commands/install';
import { uninstallCommand } from '../cli/commands/uninstall';
import { listCommand }      from '../cli/commands/list';
import { statusCommand }    from '../cli/commands/status';
import { outdatedCommand }  from '../cli/commands/outdated';
import { initCommand }      from '../cli/commands/init';
import { manifestCommand }  from '../cli/commands/manifest';
import { refreshCommand }   from '../cli/commands/refresh';

/**
 * ApmCLIController — Kozen CLI entry point for all APM actions.
 *
 * Dispatch via: npx kozen --moduleLoad=@kozen/apm --action=apm:<method>
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
   * Priority: --projectRoot CLI arg > IoC-registered apm:project-root > auto-detect.
   * The IoC value covers the common case; --projectRoot handles CI / monorepo overrides.
   */
  private async getProjectRoot(): Promise<string> {
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
   * Workaround for KZN-004: positional args not supported — uses named flag instead.
   */
  private getComponentTypes(): PackageType[] {
    const raw = (this.args?.component ?? 'skill') as string;
    return raw === 'all'
      ? [PackageType.SKILL, PackageType.AGENT]
      : [raw as PackageType];
  }

  private getSingleComponentType(): PackageType {
    return ((this.args?.component ?? 'skill') as string) === 'all'
      ? PackageType.SKILL
      : (this.args?.component ?? 'skill') as PackageType;
  }

  /**
   * Parse --packages=name1,name2 into a string array.
   * Workaround for KZN-004: Kozen has no positional arg support. When fixed,
   * replace with: this.args?._ as string[] ?? [].
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
  setup       Initialize project (create apm.config.json + apm.lock.json)
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
  --force                                      Overwrite existing apm.config.json

Refresh Options:
  --source=<name>                              Specific source name to refresh

MCP Server (expose APM as AI tools):
  npx kozen --moduleLoad=@kozen/apm --type=mcp
    `);
  }

  /** npx kozen --action=apm:install [--packages=a,b] [--component=skill] [--provider=claude] [--scope=local] */
  public async install(): Promise<void> {
    const flow       = this.getId(this.args);
    const projectRoot = await this.getProjectRoot();
    const provider   = this.getProvider();
    const scope      = this.getScope();
    const packages   = this.getPackageNames();
    const customDir  = this.args?.dir as string | undefined;

    await this.log({
      flow, src: 'APM:ApmCLIController:install',
      message: `Installing via ${provider}/${scope}`,
      category: VCategory.cli.tool,
    });

    for (const type of this.getComponentTypes()) {
      installCommand(packages, type, provider, scope, projectRoot, customDir);
    }
  }

  /** npx kozen --action=apm:uninstall [--packages=a,b] [--component=skill] [--provider=claude] [--scope=local] */
  public async uninstall(): Promise<void> {
    const flow        = this.getId(this.args);
    const projectRoot = await this.getProjectRoot();
    const provider    = this.getProvider();
    const scope       = this.getScope();
    const packages    = this.getPackageNames();
    const customDir   = this.args?.dir as string | undefined;

    await this.log({
      flow, src: 'APM:ApmCLIController:uninstall',
      message: `Removing from ${provider}/${scope}`,
      category: VCategory.cli.tool,
    });

    for (const type of this.getComponentTypes()) {
      uninstallCommand(packages, type, provider, scope, projectRoot, customDir);
    }
  }

  /** npx kozen --action=apm:list [--component=skill|agent|all] */
  public async list(): Promise<void> {
    const projectRoot = await this.getProjectRoot();
    const type        = (this.args?.component ?? 'skill') as PackageType | 'all';
    listCommand(projectRoot, type);
  }

  /** npx kozen --action=apm:status [--component=skill|agent|all] */
  public async status(): Promise<void> {
    const projectRoot = await this.getProjectRoot();
    const type        = (this.args?.component ?? 'skill') as PackageType | 'all';
    statusCommand(projectRoot, type);
  }

  /** npx kozen --action=apm:outdated [--component=skill|agent|all] */
  public async outdated(): Promise<void> {
    const projectRoot = await this.getProjectRoot();
    const type        = (this.args?.component ?? 'skill') as PackageType | 'all';
    outdatedCommand(projectRoot, type);
  }

  /** npx kozen --action=apm:setup [--yes] [--force] */
  public async setup(): Promise<void> {
    const projectRoot = await this.getProjectRoot();
    await initCommand(projectRoot, {
      yes:   Boolean(this.args?.yes),
      force: Boolean(this.args?.force),
    });
  }

  /** npx kozen --action=apm:manifest */
  public async manifest(): Promise<void> {
    const projectRoot = await this.getProjectRoot();
    manifestCommand(projectRoot);
  }

  /** npx kozen --action=apm:refresh [--source=name] */
  public async refresh(): Promise<void> {
    const projectRoot = await this.getProjectRoot();
    refreshCommand(projectRoot, this.args?.source as string | undefined);
  }
}
