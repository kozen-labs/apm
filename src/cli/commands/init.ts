import fs from 'fs';
import inquirer from 'inquirer';
import { ApmConfigManager, CONFIG_FILENAME } from '../../core/config';
import { ApmLockManager, LOCK_FILENAME } from '../../core/lock';
import { ApmManifestManager } from '../../core/manifest';
import * as log from '../../utils/log';

interface InitOptions {
  yes:   boolean;
  force: boolean;
}

/**
 * Initialize a project for APM: create apm.config.json and apm.lock.json.
 *
 * Interactive by default. Pass yes=true to accept all defaults without prompts.
 * Pass force=true to overwrite an existing apm.config.json.
 */
export async function initCommand(projectRoot: string, opts: InitOptions): Promise<void> {
  log.section('APM — Initialize project');

  const configManager = new ApmConfigManager(projectRoot);
  const lockManager   = new ApmLockManager(projectRoot);

  const configExists = configManager.read() !== null;
  const lockExists   = lockManager.read()   !== null;

  // ── apm.config.json ───────────────────────────────────────────────────────

  if (configExists && !opts.force) {
    log.skip(`${CONFIG_FILENAME} already exists  (use --force to overwrite)`);
  } else {
    const provider = opts.yes
      ? 'claude'
      : (await inquirer.prompt<{ provider: string }>([{
          type:    'list',
          name:    'provider',
          message: 'Default provider:',
          choices: ['claude', 'standard', 'vscode'],
          default: 'claude',
        }])).provider;

    const scope = opts.yes
      ? 'global'
      : (await inquirer.prompt<{ scope: string }>([{
          type:    'list',
          name:    'scope',
          message: 'Default scope:',
          choices: ['global', 'local'],
          default: 'global',
        }])).scope;

    const enableCommunity = opts.yes
      ? false
      : (await inquirer.prompt<{ enable: boolean }>([{
          type:    'confirm',
          name:    'enable',
          message: 'Enable community skill sources? (can be done later by editing apm.config.json)',
          default: false,
        }])).enable;

    const config = configManager.getOrCreate();
    config.defaultProvider = provider;
    config.defaultScope    = scope;

    if (enableCommunity) {
      for (const s of config.sources) {
        if (s.type === 'github') s.enabled = true;
      }
    }

    configManager.write(config);
    log.ok(`${CONFIG_FILENAME} written`);

    if (enableCommunity) {
      log.detail('Community sources enabled. Run `apm refresh` to clone them.');
    }
  }

  // ── apm.lock.json ─────────────────────────────────────────────────────────

  if (lockExists && !opts.force) {
    log.skip(`${LOCK_FILENAME} already exists`);
  } else {
    lockManager.writeAll([]);
    log.ok(`${LOCK_FILENAME} written  (empty — run \`apm status\` to populate)`);
  }

  // ── apm.json manifest ────────────────────────────────────────────────────

  const agentsDir = fs.existsSync(require('path').join(projectRoot, '.agents'));
  if (agentsDir) {
    const manager  = new ApmManifestManager(projectRoot);
    const manifest = manager.generate();
    manager.write(manifest);
    const { skills, agents } = manifest.packages;
    log.ok(`.agents/apm.json written — ${skills.length} skills, ${agents.length} agents`);
  }

  console.log();
  log.detail(`Edit ${CONFIG_FILENAME} to add or enable sources, then run \`apm list\` to see available packages.`);
  console.log();
}
