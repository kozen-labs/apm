import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { IApmLock } from '../models/IApmLock';
import { IApmLockEntry } from '../models/IApmLockEntry';
import { IInstalledPackage } from '../models/IInstalledPackage';

const LOCK_FILENAME = process.env.KOZEN_APM_LOCK_FILE ?? 'apm.lock.json';

/** Reads and writes the apm.lock.json install-state file. */
export class ApmLockManager {
  private readonly lockPath: string;

  constructor(projectRoot: string) {
    this.lockPath = path.join(projectRoot, LOCK_FILENAME);
  }

  async read(): Promise<IApmLock | null> {
    try {
      const text = await readFile(this.lockPath, 'utf-8');
      return JSON.parse(text) as IApmLock;
    } catch {
      return null;
    }
  }

  async writeAll(packages: IInstalledPackage[]): Promise<void> {
    const now = new Date().toISOString();
    const lock: IApmLock = {
      schemaVersion: '1.0',
      generatedAt:   now,
      packages:      packages.map(p => this.toEntry(p, now)),
    };
    await this.persist(lock);
  }

  async mergeForTarget(packages: IInstalledPackage[], provider: string, scope: string): Promise<void> {
    const existing = await this.read();
    const now      = new Date().toISOString();
    const retained = (existing?.packages ?? []).filter(
      e => !(e.provider === provider && e.scope === scope),
    );
    const fresh = packages
      .filter(p => p.provider === provider && p.scope === scope)
      .map(p  => this.toEntry(p, now));
    await this.persist({
      schemaVersion: '1.0',
      generatedAt:   now,
      packages:      this.sorted([...retained, ...fresh]),
    });
  }

  async removeEntries(names: string[], provider: string, scope: string): Promise<void> {
    const existing = await this.read();
    if (!existing) return;
    const now = new Date().toISOString();
    existing.generatedAt = now;
    existing.packages    = existing.packages.filter(
      e => !(e.provider === provider && e.scope === scope && names.includes(e.name)),
    );
    await this.persist(existing);
  }

  async getOutdated(): Promise<IApmLockEntry[]> {
    const lock = await this.read();
    return (lock?.packages ?? []).filter(e => e.isOutdated);
  }

  // ── private ──────────────────────────────────────────────────────────────

  private toEntry(p: IInstalledPackage, recordedAt: string): IApmLockEntry {
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

  private sorted(entries: IApmLockEntry[]): IApmLockEntry[] {
    return entries.sort((a, b) =>
      `${a.provider}/${a.scope}/${a.name}`.localeCompare(
        `${b.provider}/${b.scope}/${b.name}`,
      ),
    );
  }

  private async persist(lock: IApmLock): Promise<void> {
    await writeFile(this.lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf-8');
  }
}
