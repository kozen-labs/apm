import path from 'path';
import os from 'os';
import { Provider, Scope } from '../models/provider.model';

type Key = `${Provider}:${Scope}`;
type Resolver = (root: string) => string;

const SKILL_PATHS: Record<Key, Resolver> = {
  'standard:local':  r => path.join(r, '.agents', 'skills'),
  'standard:global': _ => path.join(os.homedir(), '.agents', 'skills'),
  'claude:local':    r => path.join(r, '.claude', 'skills'),
  'claude:global':   _ => path.join(os.homedir(), '.claude', 'skills'),
  'vscode:local':    r => path.join(r, '.cursor', 'rules'),
  'vscode:global':   _ => path.join(os.homedir(), '.cursor', 'rules'),
};

const AGENT_PATHS: Record<Key, Resolver> = {
  'standard:local':  r => path.join(r, '.agents', 'agents'),
  'standard:global': _ => path.join(os.homedir(), '.agents', 'agents'),
  'claude:local':    r => path.join(r, '.claude', 'agents'),
  'claude:global':   _ => path.join(os.homedir(), '.claude', 'agents'),
  'vscode:local':    r => path.join(r, '.cursor', 'rules'),
  'vscode:global':   _ => path.join(os.homedir(), '.cursor', 'rules'),
};

/**
 * Resolve the filesystem install path for a given provider / scope.
 * When `customDir` is provided it takes precedence over the table (local scope only).
 */
export function resolveInstallPath(
  provider: Provider,
  scope: Scope,
  projectRoot: string,
  resourceType: 'skill' | 'agent' = 'skill',
  customDir?: string,
): string {
  if (customDir) return customDir;
  const key: Key = `${provider}:${scope}`;
  const table = resourceType === 'agent' ? AGENT_PATHS : SKILL_PATHS;
  return table[key](projectRoot);
}

export interface InstallLocation {
  provider: Provider;
  scope:    Scope;
  path:     string;
}

export function allSkillLocations(projectRoot: string): InstallLocation[] {
  return (Object.keys(SKILL_PATHS) as Key[]).map(key => {
    const [provider, scope] = key.split(':') as [Provider, Scope];
    return { provider, scope, path: SKILL_PATHS[key](projectRoot) };
  });
}

export function allAgentLocations(projectRoot: string): InstallLocation[] {
  return (Object.keys(AGENT_PATHS) as Key[]).map(key => {
    const [provider, scope] = key.split(':') as [Provider, Scope];
    return { provider, scope, path: AGENT_PATHS[key](projectRoot) };
  });
}

/** Directories where ks-* skill sources live (not provider install targets). */
export function skillSourceBases(projectRoot: string): string[] {
  return [
    path.join(projectRoot, '.agents', 'skills'),
    path.join(projectRoot, '.claude', 'skills'),
  ];
}

/** Directories where agent .md sources live. */
export function agentSourceBases(projectRoot: string): string[] {
  return [
    path.join(projectRoot, '.agents', 'agents'),
    path.join(projectRoot, '.claude', 'agents'),
  ];
}
