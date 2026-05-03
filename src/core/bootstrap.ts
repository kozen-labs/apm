import { registerRepository } from './PluginRegistry';
import { registerProvider }   from './PluginRegistry';
import { LocalRepositoryStrategy }    from '../repositories/LocalRepositoryStrategy';
import { GitHubRepositoryStrategy }   from '../repositories/GitHubRepositoryStrategy';
import { NpmRepositoryStrategy }      from '../repositories/NpmRepositoryStrategy';
import { StandardProviderStrategy }   from '../providers/StandardProviderStrategy';
import { ClaudeProviderStrategy }     from '../providers/ClaudeProviderStrategy';
import { VscodeProviderStrategy }     from '../providers/VscodeProviderStrategy';
import { WindsurfProviderStrategy }   from '../providers/WindsurfProviderStrategy';

let bootstrapped = false;

/**
 * Register all built-in repository and provider strategy plugins.
 * Safe to call multiple times — subsequent calls are no-ops.
 *
 * Call once at CLI startup (src/cli/index.ts) before any command runs.
 * Test harnesses may call bootstrap() or register custom mocks directly.
 *
 * To add a new source type or provider:
 *   1. Implement IRepositoryStrategy or IProviderStrategy.
 *   2. Call registerRepository() / registerProvider() here or externally.
 *   No existing code needs to change.
 */
export function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  // ── Repository strategies ─────────────────────────────────────────────
  registerRepository(new LocalRepositoryStrategy());
  registerRepository(new GitHubRepositoryStrategy());
  registerRepository(new NpmRepositoryStrategy());

  // ── Provider strategies ───────────────────────────────────────────────
  registerProvider(new StandardProviderStrategy());
  registerProvider(new ClaudeProviderStrategy());
  registerProvider(new VscodeProviderStrategy());
  registerProvider(new WindsurfProviderStrategy());
}
