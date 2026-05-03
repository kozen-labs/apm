/**
 * Strip the namespace prefix from a package name.
 * 'mongodb/ks-core' → 'ks-core'
 * 'ks-core'         → 'ks-core'
 */
export function bareSkillName(name: string): string {
  const slash = name.lastIndexOf('/');
  return slash === -1 ? name : name.slice(slash + 1);
}
