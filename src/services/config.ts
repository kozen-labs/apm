import fs from 'fs';
import path from 'path';
import { ApmConfig, ApmSource } from '../models/config.model';

const CONFIG_FILENAME = process.env.KOZEN_APM_CONFIG_FILE ?? 'apm.pack.json';

const DEFAULT_CONFIG: ApmConfig = {
  schemaVersion: '1.0',
  sources: [
    {
      name:        'local',
      type:        'local',
      path:        '.',
      description: 'Local project .agents/ directory',
      enabled:     true,
    },
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
  defaultScope:    'global',
};

/** Reads and writes the project-level apm.pack.json configuration file. */
export class ApmConfigManager {
  private configPath: string;

  constructor(private readonly projectRoot: string, configPath?: string) {
    const override = configPath ?? process.env.KOZEN_APM_CONFIG;
    this.configPath = override
      ? path.resolve(projectRoot, override)
      : path.join(projectRoot, CONFIG_FILENAME);
  }

  getConfigPath(): string { return this.configPath; }

  read(): ApmConfig | null {
    try {
      return JSON.parse(fs.readFileSync(this.configPath, 'utf-8')) as ApmConfig;
    } catch {
      return null;
    }
  }

  write(config: ApmConfig): void {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  }

  getOrCreate(): ApmConfig {
    const existing = this.read();
    if (existing) return existing;
    this.write(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG, sources: [...DEFAULT_CONFIG.sources] };
  }

  getLocalSourceRoots(): string[] {
    const config = this.read();
    if (!config) return [this.projectRoot];
    const locals = config.sources.filter(
      (s: ApmSource) => s.type === 'local' && typeof s.path === 'string',
    );
    if (!locals.length) return [this.projectRoot];
    return locals.map((s: ApmSource) => path.resolve(this.projectRoot, s.path!));
  }

  getPrimarySourceRoot(): string {
    return this.getLocalSourceRoots()[0];
  }

  getEnabledSources(): ApmSource[] {
    const config = this.read();
    if (!config) return DEFAULT_CONFIG.sources.filter(s => s.enabled !== false);
    return config.sources.filter(s => s.enabled !== false);
  }

  getAllSources(): ApmSource[] {
    return this.read()?.sources ?? DEFAULT_CONFIG.sources;
  }
}
