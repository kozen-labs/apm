import fs from 'fs';
import { ApmPackage, InstalledMeta } from '../../models/package.model';
import { PackageType } from '../../models/provider.model';
import { IComponentPlugin } from './IComponentPlugin';

/**
 * HookPlugin — component plugin for hook scripts.
 *
 * Hooks are shell scripts triggered by AI tool events (e.g. pre-commit,
 * post-tool-use). Install/uninstall lifecycle is not yet implemented in v1.
 * This stub registers the component type so the CLI can enumerate it and
 * the registry can handle `--type hook` without crashing.
 *
 * Full implementation is planned for Phase 10.
 */
export class HookPlugin implements IComponentPlugin {
  readonly type          = PackageType.HOOK;
  readonly installSubdir = 'hooks';

  matchEntry(_entry: fs.Dirent, _parentDir: string): boolean { return false; }
  readMeta(_entryPath: string, _entryName: string): Partial<ApmPackage> { return {}; }
  copyTo(_src: string, _name: string, _dir: string): void { /* not implemented */ }
  removeFrom(_name: string, _dir: string): void { /* not implemented */ }
  listFrom(_dir: string, _map: Map<string, string>): InstalledMeta[] { return []; }
}
