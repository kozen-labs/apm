import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { ApmConfigManager, CONFIG_FILENAME } from './config';
import { ApmLockManager, LOCK_FILENAME } from './lock';
import { ApmManifestManager } from './manifest-manager';
import * as log from '../utils/log';

interface InitOptions {
  yes:         boolean;
  force:       boolean;
  configPath?: string;
}

/**
 * Initialize a project for APM: create apm.pack.json and apm.lock.json.
 *
 * Interactive by default. Pass yes=true to accept all defaults without prompts.
 * Pass force=true to overwrite an existing apm.pack.json.
 * Pass configPath to write the config to a non-default location.
 */
export async function initCommand(projectRoot: string, opts: InitOptions): Promise<void> {
  log.section('APM — Initialize project');

  const configManager = new ApmConfigManager(projectRoot, opts.configPath);
  const lockManager   = new ApmLockManager(projectRoot);

  const configExists = configManager.read() !== null;
  const lockExists   = lockManager.read()   !== null;

  // ── apm.pack.json ─────────────────────────────────────────────────────────

  if (configExists && !opts.force) {
    log.skip(`${CONFIG_FILENAME} already exists  (use --force to overwrite)`);
  } else {
    const provider = opts.yes
      ? 'standard'
      : (await inquirer.prompt<{ provider: string }>([{
          type:    'list',
          name:    'provider',
          message: 'Default provider:',
          choices: ['standard', 'claude', 'cursor', 'vscode', 'windsurf'],
          default: 'standard',
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
          message: `Enable community skill sources? (can be done later by editing ${CONFIG_FILENAME})`,
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
    log.ok(`${CONFIG_FILENAME} written  (${configManager.getConfigPath()})`);

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

  // ── .agents/apm.json manifest ─────────────────────────────────────────────

  if (fs.existsSync(path.join(projectRoot, '.agents'))) {
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
