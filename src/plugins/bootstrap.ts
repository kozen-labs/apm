import { registerRepository, registerProvider, registerComponent } from './PluginRegistry';

// ── Repositories ──────────────────────────────────────────────────────────────
import { LocalRepository }          from './repositories/LocalRepository';
import { GitHubRepository }         from './repositories/GitHubRepository';
import { NpmRepository }            from './repositories/NpmRepository';
import { SkillsShRepository }       from './repositories/SkillsShRepository';
import { AwesomeClaudeRepository }  from './repositories/AwesomeClaudeRepository';

// ── Providers ─────────────────────────────────────────────────────────────────
import { StandardProvider } from './providers/StandardProvider';
import { ClaudeProvider }   from './providers/ClaudeProvider';
import { CursorProvider }   from './providers/CursorProvider';
import { VscodeProvider }   from './providers/VscodeProvider';
import { WindsurfProvider } from './providers/WindsurfProvider';

// ── Component plugins ─────────────────────────────────────────────────────────
import { SkillPlugin }   from './components/SkillPlugin';
import { AgentPlugin }   from './components/AgentPlugin';
import { HookPlugin }    from './components/HookPlugin';
import { ContextPlugin } from './components/ContextPlugin';

let bootstrapped = false;

export function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  registerRepository(new LocalRepository());
  registerRepository(new GitHubRepository());
  registerRepository(new NpmRepository());
  registerRepository(new SkillsShRepository());
  registerRepository(new AwesomeClaudeRepository());

  registerProvider(new StandardProvider());
  registerProvider(new ClaudeProvider());
  registerProvider(new CursorProvider());
  registerProvider(new VscodeProvider());
  registerProvider(new WindsurfProvider());

  registerComponent(new SkillPlugin());
  registerComponent(new AgentPlugin());
  registerComponent(new HookPlugin());
  registerComponent(new ContextPlugin());
}
