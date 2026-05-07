import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { IApmConfig } from '../models/IApmConfig';
import { IApmSource } from '../models/IApmSource';

const CONFIG_FILENAME = process.env.KOZEN_APM_CONFIG_FILE ?? 'apm.pack.json';

const DEFAULT_CONFIG: IApmConfig = {
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
  private readonly configPath: string;

  constructor(private readonly projectRoot: string, configPath?: string) {
    const override = configPath ?? process.env.KOZEN_APM_CONFIG;
    this.configPath = override
      ? path.resolve(projectRoot, override)
      : path.join(projectRoot, CONFIG_FILENAME);
  }

  getConfigPath(): string { return this.configPath; }

  async read(): Promise<IApmConfig | null> {
    try {
      const text = await readFile(this.configPath, 'utf-8');
      return JSON.parse(text) as IApmConfig;
    } catch {
      return null;
    }
  }

  async write(config: IApmConfig): Promise<void> {
    await writeFile(this.configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  }

  async getOrCreate(): Promise<IApmConfig> {
    const existing = await this.read();
    if (existing) return existing;
    await this.write(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG, sources: [...DEFAULT_CONFIG.sources] };
  }

  async getLocalSourceRoots(): Promise<string[]> {
    const config = await this.read();
    if (!config) return [this.projectRoot];
    const locals = config.sources.filter(
      (s: IApmSource) => s.type === 'local' && typeof s.path === 'string',
    );
    if (!locals.length) return [this.projectRoot];
    return locals.map((s: IApmSource) => path.resolve(this.projectRoot, s.path!));
  }

  async getPrimarySourceRoot(): Promise<string> {
    return (await this.getLocalSourceRoots())[0];
  }

  async getEnabledSources(): Promise<IApmSource[]> {
    const config = await this.read();
    if (!config) return DEFAULT_CONFIG.sources.filter(s => s.enabled !== false);
    return config.sources.filter(s => s.enabled !== false);
  }

  async getAllSources(): Promise<IApmSource[]> {
    const config = await this.read();
    return config?.sources ?? DEFAULT_CONFIG.sources;
  }
}
