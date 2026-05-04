import { registerRepository, registerProvider, registerComponent } from './PluginRegistry';

// ── Repository strategies (src/plugins/repositories/) ─────────────────────────
import { LocalRepositoryStrategy }          from '../plugins/repositories/LocalRepositoryStrategy';
import { GitHubRepositoryStrategy }         from '../plugins/repositories/GitHubRepositoryStrategy';
import { NpmRepositoryStrategy }            from '../plugins/repositories/NpmRepositoryStrategy';
import { SkillsShRepositoryStrategy }       from '../plugins/repositories/SkillsShRepositoryStrategy';
import { AwesomeClaudeRegistryStrategy }    from '../plugins/repositories/AwesomeClaudeRegistryStrategy';

// ── Provider strategies (src/plugins/providers/) ──────────────────────────────
import { StandardProviderStrategy } from '../plugins/providers/StandardProviderStrategy';
import { ClaudeProviderStrategy }   from '../plugins/providers/ClaudeProviderStrategy';
import { CursorProviderStrategy }   from '../plugins/providers/CursorProviderStrategy';
import { VscodeProviderStrategy }   from '../plugins/providers/VscodeProviderStrategy';
import { WindsurfProviderStrategy } from '../plugins/providers/WindsurfProviderStrategy';

// ── Component plugins (src/plugins/components/) ───────────────────────────────
import { SkillPlugin }   from '../plugins/components/SkillPlugin';
import { AgentPlugin }   from '../plugins/components/AgentPlugin';
import { HookPlugin }    from '../plugins/components/HookPlugin';
import { ContextPlugin } from '../plugins/components/ContextPlugin';

let bootstrapped = false;

/**
 * Register all built-in repository, provider, and component plugins.
 * Safe to call multiple times — subsequent calls are no-ops.
 *
 * Call once at CLI startup (src/cli/index.ts) before any command runs.
 * Test harnesses may call bootstrap() or register custom mocks directly.
 *
 * To add a new source type, provider, or component type:
 *   1. Implement the relevant interface.
 *   2. Call the matching register*() function here.
 *   No existing code needs to change.
 */
export function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  // ── Repository strategies ─────────────────────────────────────────────────
  registerRepository(new LocalRepositoryStrategy());
  registerRepository(new GitHubRepositoryStrategy());
  registerRepository(new NpmRepositoryStrategy());
  registerRepository(new SkillsShRepositoryStrategy());
  registerRepository(new AwesomeClaudeRegistryStrategy());

  // ── Provider strategies ───────────────────────────────────────────────────
  registerProvider(new StandardProviderStrategy());
  registerProvider(new ClaudeProviderStrategy());
  registerProvider(new CursorProviderStrategy());
  registerProvider(new VscodeProviderStrategy());
  registerProvider(new WindsurfProviderStrategy());

  // ── Component plugins ─────────────────────────────────────────────────────
  registerComponent(new SkillPlugin());
  registerComponent(new AgentPlugin());
  registerComponent(new HookPlugin());
  registerComponent(new ContextPlugin());
}
