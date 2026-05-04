import fs from 'fs';
import path from 'path';
import { ApmManifest, ApmPackage } from '../models/package.model';
import { PackageType, inferGroup } from '../models/provider.model';
import { parseFrontmatter } from '../utils/frontmatter';

const MANIFEST_RELATIVE = path.join('.agents', 'apm.json');

/**
 * Reads, writes, and auto-generates the `.agents/apm.json` registry.
 *
 * The manifest is the primary source for package discovery (fast path).
 * When it is absent, `ApmRegistry` falls back to live directory scanning.
 */
export class ApmManifestManager {
  private manifestPath: string;

  constructor(private projectRoot: string) {
    this.manifestPath = path.join(projectRoot, MANIFEST_RELATIVE);
  }

  /** Read and parse the manifest. Returns null when the file does not exist. */
  read(): ApmManifest | null {
    try {
      const text = fs.readFileSync(this.manifestPath, 'utf-8');
      return JSON.parse(text) as ApmManifest;
    } catch {
      return null;
    }
  }

  /** Serialise and persist the manifest to disk. */
  write(manifest: ApmManifest): void {
    fs.mkdirSync(path.dirname(this.manifestPath), { recursive: true });
    fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  }

  /**
   * Scan the source directories and build a fresh manifest.
   * Called by `apm init` and used as fallback when `apm.json` is absent.
   */
  generate(): ApmManifest {
    const skillsDir = path.join(this.projectRoot, '.agents', 'skills');
    const agentsDir = path.join(this.projectRoot, '.agents', 'agents');

    const manifest: ApmManifest = {
      schemaVersion: '1.0',
      name:          'sdlc-skills-pack',
      displayName:   'SDLC Skills Pack',
      version:       '2.0.0',
      description:   '28 skills and 5 agents across MongoDB, Security, Software Engineering, Technologies, and Content.',
      packages: {
        skills: this.scanSkills(skillsDir),
        agents: this.scanAgents(agentsDir),
      },
    };
    return manifest;
  }

  // ── private ──────────────────────────────────────────────────────────────

  private scanSkills(baseDir: string): ApmPackage[] {
    if (!fs.existsSync(baseDir)) return [];
    const pkgs: ApmPackage[] = [];

    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('ks-')) continue;
      const skillMd = path.join(baseDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;
      const fm = parseFrontmatter(skillMd);
      pkgs.push({
        name:        entry.name,
        path:        `skills/${entry.name}`,
        type:        PackageType.SKILL,
        description: String(fm.description ?? ''),
        group:       inferGroup(entry.name),
        created:     String(fm.created  ?? ''),
        updated:     String(fm.updated  ?? ''),
        version:     String(fm.version  ?? '1.0.0'),
      });
    }
    return pkgs.sort((a, b) => a.name.localeCompare(b.name));
  }

  private scanAgents(baseDir: string): ApmPackage[] {
    if (!fs.existsSync(baseDir)) return [];
    const pkgs: ApmPackage[] = [];

    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.name.endsWith('.md')) continue;
      const agentFile = path.join(baseDir, entry.name);
      const fm = parseFrontmatter(agentFile);
      const name = entry.name.replace(/\.md$/, '');
      pkgs.push({
        name,
        path:        `agents/${entry.name}`,
        type:        PackageType.AGENT,
        description: String(fm.description ?? '').slice(0, 200),
        group:       inferGroup(name) === 'MongoDB' ? 'MongoDB' : 'MongoDB',
        created:     String(fm.created ?? ''),
        updated:     String(fm.updated ?? ''),
      });
    }
    return pkgs.sort((a, b) => a.name.localeCompare(b.name));
  }
}
