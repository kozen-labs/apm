import fs from 'fs';
import path from 'path';
import { ApmLock, ApmLockEntry } from '../models/config.model';
import { InstalledPackage } from '../models/package.model';

export const LOCK_FILENAME = 'apm.lock.json';

/**
 * Reads and writes apm.lock.json at the project root.
 *
 * The lock records the last-known state of every installed package:
 * install path, installed-updated date, source-updated date, and
 * whether the package is outdated. It is written after every
 * install, uninstall, status, and outdated operation.
 *
 * The file is gitignored — it is machine-local state, not source truth.
 */
export class ApmLockManager {
  private lockPath: string;

  constructor(private readonly projectRoot: string) {
    this.lockPath = path.join(projectRoot, LOCK_FILENAME);
  }

  /** Parse and return the lock, or null when the file does not exist. */
  read(): ApmLock | null {
    try {
      return JSON.parse(fs.readFileSync(this.lockPath, 'utf-8')) as ApmLock;
    } catch {
      return null;
    }
  }

  /**
   * Replace the entire lock with a fresh full snapshot.
   * Call this after a full-scan operation (status, outdated).
   */
  writeAll(packages: InstalledPackage[]): void {
    const now = new Date().toISOString();
    const lock: ApmLock = {
      schemaVersion: '1.0',
      generatedAt:   now,
      packages:      packages.map(p => this.toEntry(p, now)),
    };
    this.persist(lock);
  }

  /**
   * Merge freshly-installed packages into the existing lock, replacing only
   * the entries that belong to the given provider+scope combination.
   * Call this after a targeted install operation.
   */
  mergeForTarget(packages: InstalledPackage[], provider: string, scope: string): void {
    const existing = this.read();
    const now      = new Date().toISOString();
    const retained = (existing?.packages ?? []).filter(
      e => !(e.provider === provider && e.scope === scope),
    );
    const fresh = packages
      .filter(p => p.provider === provider && p.scope === scope)
      .map(p  => this.toEntry(p, now));
    this.persist({
      schemaVersion: '1.0',
      generatedAt:   now,
      packages:      this.sorted([...retained, ...fresh]),
    });
  }

  /**
   * Remove entries for the given names at a specific provider+scope.
   * Call this after a targeted uninstall operation.
   */
  removeEntries(names: string[], provider: string, scope: string): void {
    const existing = this.read();
    if (!existing) return;
    const now = new Date().toISOString();
    existing.generatedAt = now;
    existing.packages    = existing.packages.filter(
      e => !(e.provider === provider && e.scope === scope && names.includes(e.name)),
    );
    this.persist(existing);
  }

  /** Return all outdated entries without triggering a live scan. */
  getOutdated(): ApmLockEntry[] {
    return (this.read()?.packages ?? []).filter(e => e.isOutdated);
  }

  // ── private ──────────────────────────────────────────────────────────────

  private toEntry(p: InstalledPackage, recordedAt: string): ApmLockEntry {
    return {
      name:             p.name,
      type:             p.type,
      provider:         p.provider,
      scope:            p.scope,
      installPath:      p.installPath,
      installedUpdated: p.updated,
      sourceUpdated:    p.sourceUpdated,
      isOutdated:       p.isOutdated,
      recordedAt,
    };
  }

  private sorted(entries: ApmLockEntry[]): ApmLockEntry[] {
    return entries.sort((a, b) =>
      `${a.provider}/${a.scope}/${a.name}`.localeCompare(
        `${b.provider}/${b.scope}/${b.name}`,
      ),
    );
  }

  private persist(lock: ApmLock): void {
    fs.writeFileSync(this.lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf-8');
  }
}
