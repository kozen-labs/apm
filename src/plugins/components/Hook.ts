import type { Dirent } from 'fs';
import { IApmPackage } from '../../models/IApmPackage';
import { IInstalledMeta } from '../../models/IInstalledMeta';
import { PackageType } from '../../models/PackageType';
import { BaseComponent } from './BaseComponent';

/**
 * Hook — component for hook scripts.
 * Full implementation is planned for Phase 10.
 * This stub registers the component type so the CLI can enumerate it.
 */
export class Hook extends BaseComponent {
  readonly type:          PackageType;
  readonly installSubdir: string;

  constructor(dependency?: ConstructorParameters<typeof BaseComponent>[0]) {
    super(dependency);
    this.type          = PackageType.HOOK;
    this.installSubdir = 'hooks';
  }

  async matchEntry(_entry: Dirent, _parentDir: string): Promise<boolean> { return false; }
  async readMeta(_entryPath: string, _entryName: string): Promise<Partial<IApmPackage>> { return {}; }
  async copyTo(_src: string, _name: string, _dir: string): Promise<void> { /* not implemented */ }
  async removeFrom(_name: string, _dir: string): Promise<void> { /* not implemented */ }
  async listFrom(_dir: string, _map: Map<string, string>): Promise<IInstalledMeta[]> { return []; }
}
