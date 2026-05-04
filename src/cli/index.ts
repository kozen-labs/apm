#!/usr/bin/env node
import { Command, Option } from 'commander';
import inquirer from 'inquirer';
import path from 'path';

import { findProjectRoot } from '../platform/system';
import { PackageType, Provider, Scope } from '../models/provider.model';
import { bootstrap }         from '../core/bootstrap';
import { installCommand }    from './commands/install';
import { uninstallCommand }  from './commands/uninstall';
import { listCommand }       from './commands/list';
import { statusCommand }     from './commands/status';
import { outdatedCommand }   from './commands/outdated';
import { initCommand }       from './commands/init';
import { manifestCommand }   from './commands/manifest';
import { refreshCommand }    from './commands/refresh';
import * as log from '../utils/log';

bootstrap();

// ── config file resolution ────────────────────────────────────────────────────
// Extract --config=<path> from argv before Commander parses the rest so that
// PROJECT_ROOT can be derived from it at startup. Priority:
//   --config=<path> CLI arg  >  APM_CONFIG env var  >  auto-detected root

function extractConfigArg(): string | undefined {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--config=')) return arg.slice('--config='.length);
  }
  return undefined;
}

const CONFIG_OVERRIDE = extractConfigArg() ?? process.env.APM_CONFIG;

const PROJECT_ROOT = CONFIG_OVERRIDE
  ? path.dirname(path.resolve(CONFIG_OVERRIDE))
  : findProjectRoot();

const LOG_DIR = path.join(PROJECT_ROOT, 'tmp', 'apm');

// ── reusable option factories ─────────────────────────────────────────────────

const mkTypeOpt = () =>
  new Option('--type <type>', 'Package type')
    .choices(['skill', 'agent', 'all'])
    .default('skill');

const mkProviderOpt = () =>
  new Option('--provider <name>', 'Target provider')
    .choices(['standard', 'claude', 'cursor', 'vscode', 'windsurf'])
    .default('standard');

const mkScopeOpt = () =>
  new Option('--scope <s>', 'Installation scope')
    .choices(['local', 'global'])
    .default('local');

const mkDirOpt = () =>
  new Option('--dir <path>', 'Custom install directory (overrides scope path)');

const mkConfigOpt = () =>
  new Option('--config <path>', 'Path to apm.pack.json (overrides APM_CONFIG env var)');

// ── session log helpers ───────────────────────────────────────────────────────

function openSessionLog(provider: string, scope: string, action: string): void {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  log.openLog(path.join(LOG_DIR, `${ts}_${action}_${provider}_${scope}.log`));
}

function closeSessionLog(): void {
  const lp = log.getLogPath();
  log.closeLog();
  if (lp) log.detail(`Full log: ${lp}`);
}

// ── CLI program ───────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('apm')
  .description('APM - Agent Package Manager  |  manage AI skills, agents, and hooks')
  .version('1.0.0', '-v, --version');

// init
program
  .command('init')
  .description('Initialize a project for APM — create apm.pack.json and apm.lock.json')
  .option('-y, --yes',   'Accept all defaults without prompts', false)
  .option('-f, --force', 'Overwrite existing apm.pack.json', false)
  .addOption(mkConfigOpt())
  .action(opts => {
    const configPath = (opts.config as string | undefined) ?? CONFIG_OVERRIDE;
    const root = configPath ? path.dirname(path.resolve(configPath)) : PROJECT_ROOT;
    initCommand(root, { yes: opts.yes, force: opts.force, configPath })
      .catch(err => { console.error(err); process.exit(1); });
  });

// install
program
  .command('install [pkgs...]')
  .description('Install packages (default: all of the selected type)')
  .addOption(mkTypeOpt())
  .addOption(mkProviderOpt())
  .addOption(mkScopeOpt())
  .addOption(mkDirOpt())
  .action((pkgs: string[], opts) => {
    const provider = opts.provider as Provider;
    const scope    = opts.scope    as Scope;
    log.banner('APM — Agent Package Manager');
    log.settingsLine(provider, scope, opts.type);
    openSessionLog(provider, scope, 'install');
    try {
      runForTypes(opts.type, t => installCommand(pkgs, t, provider, scope, PROJECT_ROOT, opts.dir));
    } finally { closeSessionLog(); }
  });

// uninstall
program
  .command('uninstall [pkgs...]')
  .description('Remove installed packages (default: all at target)')
  .addOption(mkTypeOpt())
  .addOption(mkProviderOpt())
  .addOption(mkScopeOpt())
  .addOption(mkDirOpt())
  .action((pkgs: string[], opts) => {
    const provider = opts.provider as Provider;
    const scope    = opts.scope    as Scope;
    log.banner('APM — Agent Package Manager');
    log.settingsLine(provider, scope, opts.type);
    openSessionLog(provider, scope, 'uninstall');
    try {
      runForTypes(opts.type, t => uninstallCommand(pkgs, t, provider, scope, PROJECT_ROOT, opts.dir));
    } finally { closeSessionLog(); }
  });

// list
program
  .command('list')
  .description('List available packages from the source registry')
  .addOption(mkTypeOpt())
  .action(opts => listCommand(PROJECT_ROOT, opts.type as PackageType | 'all'));

// status
program
  .command('status')
  .description('Show installed packages across all providers (highlights outdated)')
  .addOption(mkTypeOpt())
  .action(opts => statusCommand(PROJECT_ROOT, opts.type as PackageType | 'all'));

// outdated
program
  .command('outdated')
  .description('Show installed packages that have a newer version available')
  .addOption(mkTypeOpt())
  .action(opts => outdatedCommand(PROJECT_ROOT, opts.type as PackageType | 'all'));

// manifest
program
  .command('manifest')
  .description('Scan source directories and write/refresh .agents/apm.json')
  .action(() => manifestCommand(PROJECT_ROOT));

// refresh
program
  .command('refresh [source]')
  .description('Pull latest from remote sources (all github sources by default, or a named one)')
  .action((source?: string) => refreshCommand(PROJECT_ROOT, source));

// ── interactive menu (no arguments) ──────────────────────────────────────────

async function interactiveMenu(): Promise<void> {
  log.banner('APM — Agent Package Manager');

  const { action } = await inquirer.prompt<{ action: string }>([{
    type: 'list', name: 'action',
    message: 'What would you like to do?',
    choices: [
      { name: '1  install    Install packages',                value: 'install'   },
      { name: '2  uninstall  Remove installed packages',       value: 'uninstall' },
      { name: '3  list       List available packages',         value: 'list'      },
      { name: '4  status     Show installed packages',         value: 'status'    },
      { name: '5  outdated   Show outdated packages',          value: 'outdated'  },
      { name: '6  init       Initialize project (config+lock)', value: 'init'     },
      { name: '7  manifest   Refresh .agents/apm.json',        value: 'manifest'  },
      { name: '8  refresh    Pull latest from remote sources', value: 'refresh'   },
      { name: '0  exit',                                       value: 'exit'      },
    ],
  }]);

  if (action === 'exit')     { console.log('  Bye.'); process.exit(0); }
  if (action === 'init')     { await initCommand(PROJECT_ROOT, { yes: false, force: false }); return; }
  if (action === 'manifest') { manifestCommand(PROJECT_ROOT); return; }
  if (action === 'refresh')  { refreshCommand(PROJECT_ROOT); return; }

  const { type } = await inquirer.prompt<{ type: string }>([{
    type: 'list', name: 'type', message: 'Package type:',
    choices: ['skill', 'agent', 'all'], default: 'skill',
  }]);

  if (action === 'list')     { listCommand(PROJECT_ROOT,     type as PackageType | 'all'); return; }
  if (action === 'status')   { statusCommand(PROJECT_ROOT,   type as PackageType | 'all'); return; }
  if (action === 'outdated') { outdatedCommand(PROJECT_ROOT, type as PackageType | 'all'); return; }

  const { provider } = await inquirer.prompt<{ provider: string }>([{
    type: 'list', name: 'provider', message: 'Provider:',
    choices: ['standard', 'claude', 'cursor', 'vscode', 'windsurf'], default: 'standard',
  }]);

  const { scope } = await inquirer.prompt<{ scope: string }>([{
    type: 'list', name: 'scope', message: 'Scope:',
    choices: ['local', 'global'], default: 'local',
  }]);

  let customDir: string | undefined;
  if (scope === 'local') {
    const { useCustomDir } = await inquirer.prompt<{ useCustomDir: boolean }>([{
      type: 'confirm', name: 'useCustomDir',
      message: 'Install to a custom directory?', default: false,
    }]);
    if (useCustomDir) {
      const { dirPath } = await inquirer.prompt<{ dirPath: string }>([{
        type: 'input', name: 'dirPath', message: 'Install directory path:',
      }]);
      customDir = dirPath.trim();
    }
  }

  log.settingsLine(provider, scope, type);
  openSessionLog(provider, scope, action);

  try {
    const prov = provider as Provider;
    const scp  = scope    as Scope;
    runForTypes(type, t => {
      if (action === 'install')   installCommand([], t, prov, scp, PROJECT_ROOT, customDir);
      if (action === 'uninstall') uninstallCommand([], t, prov, scp, PROJECT_ROOT, customDir);
    });
  } finally { closeSessionLog(); }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function runForTypes(type: string, fn: (t: PackageType) => void): void {
  if (type === 'all') {
    fn(PackageType.SKILL);
    fn(PackageType.AGENT);
  } else {
    fn(type as PackageType);
  }
}

// ── entry point ───────────────────────────────────────────────────────────────

if (process.argv.length <= 2) {
  interactiveMenu().catch(err => { console.error(err); process.exit(1); });
} else {
  program.parseAsync(process.argv).catch(err => { console.error(err); process.exit(1); });
}
