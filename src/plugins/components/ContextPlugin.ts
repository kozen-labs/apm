import fs from 'fs';
import { ApmPackage, InstalledMeta } from '../../models/package.model';
import { PackageType } from '../../models/provider.model';
import { BaseComponentPlugin } from './BaseComponentPlugin';

/**
 * ContextPlugin — component plugin for context definition files.
 *
 * Contexts are structured markdown files that inject domain knowledge into
 * an AI session (e.g. project glossary, architecture overview). They differ
 * from skills in that they are not prefixed with 'ks-' and do not contain
 * executable instructions — only reference material.
 *
 * Full implementation is planned for a future phase.
 * This stub registers the component type so the CLI can enumerate it.
 */
export class ContextPlugin extends BaseComponentPlugin {
  readonly type          = PackageType.CONTEXT;
  readonly installSubdir = 'contexts';

  matchEntry(_entry: fs.Dirent, _parentDir: string): boolean { return false; }
  readMeta(_entryPath: string, _entryName: string): Partial<ApmPackage> { return {}; }
  copyTo(_src: string, _name: string, _dir: string): void { /* not implemented */ }
  removeFrom(_name: string, _dir: string): void { /* not implemented */ }
  listFrom(_dir: string, _map: Map<string, string>): InstalledMeta[] { return []; }
}
