import fs from 'fs';
import path from 'path';
import os from 'os';
import { ApmPackage, InstalledPackage } from '../../models/package.model';
import { PackageType, Provider, Scope } from '../../models/provider.model';
import { bareSkillName } from '../../utils/pkg';
import { getComponent } from '../../core/PluginRegistry';
import { IProviderStrategy } from './IProviderStrategy';

/**
 * ClaudeProviderStrategy — installs to the .claude/skills|agents/ tree.
 *
 * local scope:  <projectRoot>/.claude/skills|agents/
 * global scope: ~/.claude/skills|agents/
 *
 * Delegates install, uninstall, and listInstalled to IComponentPlugin.
 * postInstall rewrites and copies manifest.json so Claude Code can discover
 * the installed skills via its plugin registry.
 */
export class ClaudeProviderStrategy implements IProviderStrategy {
  readonly name = Provider.CLAUDE;

  getInstallPath(scope: Scope, projectRoot: string, customDir?: string): string {
    if (customDir) return customDir;
    return scope === Scope.GLOBAL
      ? path.join(os.homedir(), '.claude', 'skills')
      : path.join(projectRoot,  '.claude', 'skills');
  }

  install(pkg: ApmPackage, pkgLocalPath: string, installPath: string): void {
    getComponent(pkg.type).copyTo(pkgLocalPath, bareSkillName(pkg.name), installPath);
  }

  uninstall(name: string, type: PackageType, installPath: string): void {
    getComponent(type).removeFrom(bareSkillName(name), installPath);
  }

  listInstalled(installPath: string, type: PackageType, sourceMap: Map<string, string>): InstalledPackage[] {
    return getComponent(type).listFrom(installPath, sourceMap).map(e => ({
      name:         e.name,
      type,
      provider:     Provider.CLAUDE,
      scope:        Scope.LOCAL,
      installPath:  e.installPath,
      updated:      e.installedUpdated,
      sourceUpdated: e.sourceUpdated,
      isOutdated:   e.isOutdated,
    }));
  }

  /**
   * Rewrite path prefixes in manifest.json so paths are relative to the
   * install directory, then copy it next to the installed skills.
   */
  postInstall(installPath: string, sourceRoot: string): void {
    const src = path.join(sourceRoot, '.claude', 'manifest.json');
    if (!fs.existsSync(src)) return;
    try {
      let text = fs.readFileSync(src, 'utf-8');
      text = text.replace(/"\.\.\/\.agents\/skills\//g, '"');
      text = text.replace(/"\.\.\/\.claude\/skills\//g, '"');
      fs.writeFileSync(path.join(installPath, 'manifest.json'), text, 'utf-8');
    } catch {
      // manifest.json is best-effort — don't fail the install.
    }
  }
}
