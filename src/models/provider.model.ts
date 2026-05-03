/**
 * Enums and constants shared across the APM system.
 */

export enum PackageType {
  SKILL = 'skill',
  AGENT = 'agent',
  HOOK  = 'hook',
}

export enum Provider {
  STANDARD = 'standard',
  CLAUDE   = 'claude',
  VSCODE   = 'vscode',
}

export enum Scope {
  LOCAL  = 'local',
  GLOBAL = 'global',
}

export const GROUPS = {
  MONGODB:              'MongoDB',
  SECURITY:             'Security',
  SOFTWARE_ENGINEERING: 'Software Engineering',
  TECHNOLOGIES:         'Technologies',
  CONTENT:              'Content & Communication',
} as const;

export type GroupName = (typeof GROUPS)[keyof typeof GROUPS];

/** Derive display group from a ks-* package name. */
export function inferGroup(name: string): GroupName {
  const base = name.replace(/^ks-/, '').split('-')[0];
  if (base === 'mongodb')                                      return GROUPS.MONGODB;
  if (base === 'security')                                     return GROUPS.SECURITY;
  if (['software', 'ai', 'quality', 'project'].includes(base)) return GROUPS.SOFTWARE_ENGINEERING;
  if (['devops', 'apache', 'sql', 'artificial'].includes(base)) return GROUPS.TECHNOLOGIES;
  return GROUPS.CONTENT;
}
