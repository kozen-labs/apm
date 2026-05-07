import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import path from 'path';
import { IApmManifest } from '../models/IApmManifest';
import { IApmPackage } from '../models/IApmPackage';
import { PackageType } from '../models/PackageType';
import { inferGroup } from '../models/Groups';
import { parseFrontmatterAsync } from '../utils/frontmatter';

const MANIFEST_FILE = process.env.KOZEN_APM_MANIFEST_FILE ?? path.join('.agents', 'apm.json');

/** Reads, writes, and generates the .agents/apm.json source manifest. */
export class ApmManifestManager {
  private readonly manifestPath: string;

  constructor(projectRoot: string) {
    this.manifestPath = path.join(projectRoot, MANIFEST_FILE);
  }

  async read(): Promise<IApmManifest | null> {
    try {
      const text = await readFile(this.manifestPath, 'utf-8');
      return JSON.parse(text) as IApmManifest;
    } catch {
      return null;
    }
  }

  async write(manifest: IApmManifest): Promise<void> {
    await mkdir(path.dirname(this.manifestPath), { recursive: true });
    await writeFile(this.manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  }

  async generate(): Promise<IApmManifest> {
    const skillsDir = path.join(path.dirname(this.manifestPath), 'skills');
    const agentsDir = path.join(path.dirname(this.manifestPath), 'agents');

    const [skills, agents] = await Promise.all([
      this.scanSkills(skillsDir),
      this.scanAgents(agentsDir),
    ]);

    return {
      schemaVersion: '1.0',
      name:          'sdlc-skills-pack',
      displayName:   'SDLC Skills Pack',
      version:       '2.0.0',
      description:   '28 skills and 5 agents across MongoDB, Security, Software Engineering, Technologies, and Content.',
      packages: { skills, agents },
    };
  }

  // ── private ──────────────────────────────────────────────────────────────

  private async scanSkills(baseDir: string): Promise<IApmPackage[]> {
    let entries;
    try {
      entries = await readdir(baseDir, { withFileTypes: true });
    } catch {
      return [];
    }

    const pkgs = await Promise.all(
      entries
        .filter(e => e.isDirectory() && e.name.startsWith('ks-'))
        .map(async entry => {
          const skillMd = path.join(baseDir, entry.name, 'SKILL.md');
          try {
            await readFile(skillMd);
          } catch {
            return null;
          }
          const fm = await parseFrontmatterAsync(skillMd);
          return {
            name:        entry.name,
            path:        `skills/${entry.name}`,
            type:        PackageType.SKILL,
            description: String(fm.description ?? ''),
            group:       inferGroup(entry.name),
            created:     String(fm.created  ?? ''),
            updated:     String(fm.updated  ?? ''),
            version:     String(fm.version  ?? '1.0.0'),
          } satisfies IApmPackage;
        }),
    );

    return (pkgs.filter(Boolean) as IApmPackage[]).sort((a, b) => a.name.localeCompare(b.name));
  }

  private async scanAgents(baseDir: string): Promise<IApmPackage[]> {
    let entries;
    try {
      entries = await readdir(baseDir, { withFileTypes: true });
    } catch {
      return [];
    }

    const pkgs = await Promise.all(
      entries
        .filter(e => e.isFile() && e.name.endsWith('.md'))
        .map(async entry => {
          const agentFile = path.join(baseDir, entry.name);
          const fm        = await parseFrontmatterAsync(agentFile);
          const name      = entry.name.replace(/\.md$/, '');
          return {
            name,
            path:        `agents/${entry.name}`,
            type:        PackageType.AGENT,
            description: String(fm.description ?? '').slice(0, 200),
            group:       inferGroup(name),
            created:     String(fm.created ?? ''),
            updated:     String(fm.updated ?? ''),
          } satisfies IApmPackage;
        }),
    );

    return pkgs.sort((a, b) => a.name.localeCompare(b.name));
  }
}
