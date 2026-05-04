import fs from 'fs';
import path from 'path';
import { ApmConfig, ApmSource } from '../models/config.model';

export const CONFIG_FILENAME = 'apm.config.json';

/**
 * Default configuration created on first run.
 *
 * The local source (enabled: true) is always active.
 * Community sources are pre-configured but disabled by default.
 * To enable one, set "enabled": true and run `apm refresh <name>`.
 */
const DEFAULT_CONFIG: ApmConfig = {
  schemaVersion: '1.0',
  sources: [
    // ── Local project source (always active) ────────────────────────────
    {
      name:        'local',
      type:        'local',
      path:        '.',
      description: 'Local project .agents/ directory',
      enabled:     true,
    },
    // ── Official Kozen registry ───────────────────────────────────────────
    {
      name:        'kozen',
      type:        'github',
      url:         'https://github.com/kozen-labs/agentic',
      ref:         'main',
      skillsPath:  '.agents/skills',
      agentsPath:  '.agents/agents',
      description: 'Official Kozen community skill and agent registry',
      enabled:     false,
    },
    // ── Community repositories (disabled until you enable them) ──────────
    {
      name:        'mongodb-official',
      type:        'github',
      url:         'https://github.com/mongodb/agent-skills',
      ref:         'main',
      namespace:   'mongodb',
      skillsPath:  '.agents/skills',
      agentsPath:  '.agents/agents',
      description: 'Official MongoDB SDLC Skills Pack (28 skills, 5 agents)',
      enabled:     false,
    },
    {
      name:        'vercel-skills',
      type:        'skills-sh',
      url:         'https://github.com/vercel-labs/skills',
      namespace:   'vercel',
      skillsPath:  'skills',
      description: 'Vercel Labs skills (skills.sh-compatible format)',
      enabled:     false,
    },
    {
      name:        'awesome-claude',
      type:        'awesome-claude',
      url:         'https://awesomeclaude.ai/api/skills.json',
      description: 'AwesomeClaude.ai curated skill catalog',
      enabled:     false,
    },
    {
      name:        'karpathy',
      type:        'github',
      url:         'https://github.com/forrestchang/andrej-karpathy-skills',
      namespace:   'karpathy',
      skillsPath:  'skills',
      description: 'Andrej Karpathy coding principles (by forrestchang)',
      enabled:     false,
    },
    {
      name:        'mattpocock',
      type:        'github',
      url:         'https://github.com/mattpocock/skills',
      namespace:   'mattpocock',
      skillsPath:  'skills',
      description: 'Matt Pocock TypeScript skills',
      enabled:     false,
    },
    {
      name:        'anthropic',
      type:        'github',
      url:         'https://github.com/anthropics/skills',
      namespace:   'anthropic',
      skillsPath:  'skills',
      description: 'Anthropic official skills',
      enabled:     false,
    },
  ],
  defaultProvider: 'standard',
  defaultScope: 'global',
};

/**
 * Reads, writes, and creates apm.config.json at the project root.
 *
 * The config tells APM where to find packages (sources) and provides
 * install defaults. When absent, a default local-source config is
 * created on first call to getOrCreate().
 *
 * Future: sources with type 'github' or 'npm' will be resolved by
 * a remote fetcher (not yet implemented).
 */
export class ApmConfigManager {
  private configPath: string;

  constructor(private readonly projectRoot: string) {
    this.configPath = path.join(projectRoot, CONFIG_FILENAME);
  }

  /** Parse and return the config, or null when the file does not exist. */
  read(): ApmConfig | null {
    try {
      return JSON.parse(fs.readFileSync(this.configPath, 'utf-8')) as ApmConfig;
    } catch {
      return null;
    }
  }

  /** Serialise and persist the config. */
  write(config: ApmConfig): void {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  }

  /**
   * Return the existing config, or create and persist a default one.
   * The default config points to the local project root as the only source.
   */
  getOrCreate(): ApmConfig {
    const existing = this.read();
    if (existing) return existing;
    this.write(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG, sources: [...DEFAULT_CONFIG.sources] };
  }

  /**
   * Return all resolved absolute paths for local sources.
   * Paths are resolved relative to projectRoot.
   * Falls back to [projectRoot] when no config is present.
   */
  getLocalSourceRoots(): string[] {
    const config = this.read();
    if (!config) return [this.projectRoot];
    const locals = config.sources.filter(
      (s: ApmSource) => s.type === 'local' && typeof s.path === 'string',
    );
    if (!locals.length) return [this.projectRoot];
    return locals.map((s: ApmSource) => path.resolve(this.projectRoot, s.path!));
  }

  /** Primary source root: the first resolved local source, or projectRoot. */
  getPrimarySourceRoot(): string {
    return this.getLocalSourceRoots()[0];
  }

  /** All sources with enabled !== false, sorted: local first. */
  getEnabledSources(): ApmSource[] {
    const config = this.read();
    if (!config) return DEFAULT_CONFIG.sources.filter(s => s.enabled !== false);
    return config.sources.filter(s => s.enabled !== false);
  }

  /** All sources including disabled ones (for `apm list --all-sources`). */
  getAllSources(): ApmSource[] {
    return this.read()?.sources ?? DEFAULT_CONFIG.sources;
  }
}
