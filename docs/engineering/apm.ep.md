# EP: APM — Agent Package Manager

## Status
Draft
Version: 1.0   Author: Antonio Membrides Espinosa   Last updated: 2026-05-03
PRD reference: [docs/requirements/apm.prd.md](../requirements/apm.prd.md)

---

## 1. Background

APM is a CLI tool for discovering, installing, updating, and auditing AI development context files (skills, agents, hooks) across multiple AI tools and project scopes. The full business case and user requirements are in the PRD referenced above.

This document covers the technical architecture, data model, key algorithms, implementation phases, and the decisions made during design.

---

## 2. Goals and non-goals (engineering perspective)

**Goals:**

- A Microkernel core that dispatches to pluggable strategies for both source types and install targets, so new providers and repositories require no changes to existing code.
- A unified CLI with a consistent option set across all commands (`--type`, `--provider`, `--scope`, `--dir`).
- A lock file that records install state after every mutating operation, enabling offline drift detection.
- Cross-platform behavior on Windows 10+, macOS 12+, and Linux with no native binary dependencies.
- Full TypeScript type safety with no `any` in the public API surface.

**Non-goals:**

- A network-based central registry (all sources are local filesystem or GitHub).
- GUI or web dashboard (CLI only in v1).
- Package dependency resolution (packages are independent in v1).
- Authentication for private GitHub repositories.
- Hook install/uninstall logic (config model includes `hooksPath` for future use; no CLI command yet).

---

## 3. Proposed solution

### 3.1 Overview

APM is structured as a Microkernel with two plugin contracts:

```
apm CLI
  │
  ├── PluginRegistry (kernel)
  │     ├── IRepositoryStrategy  ← how packages are discovered and located
  │     │     ├── LocalRepositoryStrategy
  │     │     └── GitHubRepositoryStrategy
  │     └── IProviderStrategy    ← how packages are installed
  │           ├── StandardProviderStrategy
  │           ├── ClaudeProviderStrategy
  │           └── VscodeProviderStrategy
  │
  ├── ApmRegistry   (uses PluginRegistry to answer "what is available / installed?")
  ├── ApmInstaller  (uses PluginRegistry to answer "how do I install / uninstall?")
  │
  └── Managers (stateless file I/O wrappers)
        ├── ApmConfigManager  → apm.config.json
        ├── ApmLockManager    → apm.lock.json
        └── ApmManifestManager → .agents/apm.json
```

All plugin registration happens once in `bootstrap.ts`, called at CLI startup. A test harness or third-party consumer can skip `bootstrap()` and register its own mocks directly against `PluginRegistry`.

### 3.2 Architecture and system design

#### Microkernel (PluginRegistry)

`src/core/PluginRegistry.ts` holds two `Map<string, Strategy>` instances:

```typescript
const repositories = new Map<string, IRepositoryStrategy>();
const providers    = new Map<string, IProviderStrategy>();
```

Dispatch is by string key: `source.type` for repositories, `Provider` enum value for providers. Registration is one-line:

```typescript
registerRepository(new GitHubRepositoryStrategy());
registerProvider(new ClaudeProviderStrategy());
```

This is the only place in the codebase that knows about all strategy implementations. Every other module uses the registry for lookup, never importing strategies directly.

#### Strategy pattern: IRepositoryStrategy

Answers the question "where does a package come from?".

```typescript
interface IRepositoryStrategy {
  readonly type: string;
  list(source, cacheDir, projectRoot): ApmPackage[];
  getLocalPath(pkg, source, cacheDir, projectRoot): string;
  refresh(source, cacheDir): void;
  isStale(source, cacheDir): boolean;
}
```

`LocalRepositoryStrategy` reads from disk. `GitHubRepositoryStrategy` clones to `~/apm.cache/{source.name}/` then delegates to `LocalRepositoryStrategy` using a synthetic local source pointing at the cache directory. This composition means GitHub sources benefit from all future improvements to local scanning for free.

#### Strategy pattern: IProviderStrategy

Answers the question "how is a package installed?".

```typescript
interface IProviderStrategy {
  readonly name: string;
  getInstallPath(scope, projectRoot, customDir?): string;
  install(pkg, pkgLocalPath, installPath): void;
  uninstall(name, type, installPath): void;
  listInstalled(installPath, type, sourceMap): InstalledPackage[];
  postInstall(installPath, sourceRoot): void;
}
```

Each provider owns its own format logic. VSCode converts SKILL.md to `.mdc`. Claude writes a `manifest.json` in `postInstall`. Standard copies directories as-is. None of this logic touches the core.

#### Package path resolution (two-stage fast-path)

When the installer needs the local filesystem path for a package:

1. **Fast path**: `pkg.localPath` is set at `list()` time by the repository strategy. Direct return, no lookup.
2. **Fallback**: look up the source by `pkg.sourceRef`, get the strategy from `PluginRegistry`, call `getLocalPath()`. Handles packages deserialized from `apm.json` where `localPath` was never set.

`localPath` is a runtime-only field, never serialized. `sourceRef` is the only persistent link back to the source.

#### Outdated detection

Each installed package has a string `updated` date (ISO YYYY-MM-DD) read from the installed file's frontmatter. The registry builds a `Map<name, sourceUpdated>` from `getAvailable()`. In `listInstalled()`, each provider strategy reads the installed copy's `updated` field and compares:

```
isOutdated = !!sourceUpdated && !!installedUpdated && sourceUpdated > installedUpdated
```

String comparison is sufficient because ISO date strings sort lexicographically.

### 3.3 Data model

#### apm.config.json

```typescript
interface ApmConfig {
  schemaVersion: string;           // "1.0"
  sources: ApmSource[];
  defaultProvider?: string;        // "claude" | "standard" | "vscode"
  defaultScope?: string;           // "local" | "global"
}

interface ApmSource {
  name: string;                    // unique key; used as cache dir name
  type: 'local' | 'github' | 'npm';
  // local:
  path?: string;                   // relative to projectRoot
  // github:
  url?: string;
  ref?: string;                    // branch/tag (default: repo default)
  // path overrides:
  skillsPath?: string;             // default: '.agents/skills'
  agentsPath?: string;             // default: '.agents/agents'
  hooksPath?: string;              // default: '.agents/hooks'
  // namespace:
  namespace?: string;              // prefix: 'mongodb' → 'mongodb/ks-core'
  // single-resource repos:
  singleResource?: boolean;
  resourceName?: string;
  // lifecycle:
  description?: string;
  enabled?: boolean;               // default: true
}
```

Full example with all five community sources:

```json
{
  "schemaVersion": "1.0",
  "sources": [
    {
      "name": "local",
      "type": "local",
      "path": ".",
      "description": "Local project .agents/ directory",
      "enabled": true
    },
    {
      "name": "mongodb-official",
      "type": "github",
      "url": "https://github.com/mongodb/agent-skills",
      "ref": "main",
      "namespace": "mongodb",
      "skillsPath": ".agents/skills",
      "agentsPath": ".agents/agents",
      "description": "Official MongoDB SDLC Skills Pack (28 skills, 5 agents)",
      "enabled": false
    },
    {
      "name": "karpathy",
      "type": "github",
      "url": "https://github.com/forrestchang/andrej-karpathy-skills",
      "namespace": "karpathy",
      "skillsPath": "skills",
      "description": "Andrej Karpathy coding principles (by forrestchang)",
      "enabled": false
    },
    {
      "name": "mattpocock",
      "type": "github",
      "url": "https://github.com/mattpocock/skills",
      "namespace": "mattpocock",
      "skillsPath": "skills",
      "description": "Matt Pocock TypeScript skills",
      "enabled": false
    },
    {
      "name": "anthropic",
      "type": "github",
      "url": "https://github.com/anthropics/skills",
      "namespace": "anthropic",
      "skillsPath": "skills",
      "description": "Anthropic official skills",
      "enabled": false
    },
    {
      "name": "skilluse",
      "type": "github",
      "url": "https://github.com/skilluse/skilluse",
      "namespace": "skilluse",
      "skillsPath": ".claude/skills",
      "description": "SkillUse community skill registry",
      "enabled": false
    }
  ],
  "defaultProvider": "claude",
  "defaultScope": "global"
}
```

#### apm.lock.json

```typescript
interface ApmLock {
  schemaVersion: string;     // "1.0"
  generatedAt: string;       // ISO-8601 timestamp
  packages: ApmLockEntry[];
}

interface ApmLockEntry {
  name: string;
  type: string;              // "skill" | "agent"
  provider: string;          // "claude" | "standard" | "vscode"
  scope: string;             // "local" | "global"
  installPath: string;       // absolute path of installed copy
  installedUpdated: string;  // `updated` field from installed frontmatter
  sourceUpdated: string;     // `updated` field from source at record time
  isOutdated: boolean;
  recordedAt: string;        // ISO-8601 timestamp of last write
}
```

#### ApmPackage

```typescript
interface ApmPackage {
  name: string;
  path: string;              // relative path within source (serialized to apm.json)
  type: PackageType;         // SKILL | AGENT | HOOK
  description: string;
  group: string;             // inferred from name prefix
  created: string;
  updated: string;
  version?: string;
  sourceRef?: string;        // ApmSource.name (serialized; used for path fallback)
  localPath?: string;        // absolute path (runtime only; never serialized)
}
```

### 3.4 CLI design

Commander.js program registered in `src/cli/index.ts`. All strategy registration happens via `bootstrap()` before any command action runs.

| Command | Options | Action |
|---|---|---|
| `init` | `--yes`, `--force` | Create `apm.config.json` + `apm.lock.json`; scan `.agents/` |
| `install [pkgs...]` | `--type`, `--provider`, `--scope`, `--dir` | Install packages via provider strategy |
| `uninstall [pkgs...]` | `--type`, `--provider`, `--scope`, `--dir` | Remove via provider strategy |
| `list` | `--type` | List available packages from all enabled sources |
| `status` | `--type` | List installed packages (all providers, all scopes) |
| `outdated` | `--type` | List installed packages where source is newer |
| `manifest` | — | Scan `.agents/` and write `.agents/apm.json` |
| `refresh [source]` | — | Pull latest from GitHub sources |

No-argument invocation opens an `inquirer.js` interactive menu that walks through the same option set step by step.

Session logs are written to `tmp/apm/{ISO-timestamp}_{action}_{provider}_{scope}.log` with ANSI escape codes stripped.

### 3.5 GitHub caching strategy

```
apm refresh <source>
  → git clone --depth=1 <url> ~/apm.cache/<name>/   (first time)
  → git -C ~/apm.cache/<name>/ pull --ff-only        (subsequent)
  → write ~/apm.cache/<name>/.apm-last-refresh       (ISO timestamp)

isStale(): mtime of .apm-last-refresh > 24h → true
```

On clone failure the partial directory is removed atomically. On `list()` call against an uncached source the clone runs inline. The 24-hour staleness threshold is a constant; no user configuration in v1.

### 3.6 Security considerations

- **Source overwrite guard**: `ApmInstaller.guardSourceOverwrite()` detects when the computed install target path equals the source directory and emits a warning before any copy begins.
- **GitHub URL trust**: `apm.config.json` is machine-local (gitignored). The URLs in it are controlled by the developer. No URL validation or SSRF protection is needed for the CLI use case.
- **Cache integrity**: cached GitHub repos are plain git working trees. No checksum verification beyond what git provides. Sufficient for developer tooling.
- **`apm.config.json` and `apm.lock.json` are gitignored**: `.gitignore` instructions in all setup docs. APM does not enforce this at runtime.

### 3.7 Testing strategy

- **Unit tests**: `ApmConfigManager`, `ApmLockManager`, `ApmManifestManager` — tested against temp directory fixtures.
- **Integration tests**: `ApmRegistry.getAvailable()` and `ApmInstaller.install()` against a real local source fixture in `test/fixtures/`.
- **Provider strategy tests**: each strategy (`StandardProviderStrategy`, `ClaudeProviderStrategy`, `VscodeProviderStrategy`) tested with a temp install directory.
- **Repository strategy tests**: `LocalRepositoryStrategy` against fixture; `GitHubRepositoryStrategy` with `execSync` mocked to avoid network calls.
- **CLI smoke tests**: Commander parse tree validated via unit tests; full E2E deferred.
- **Cross-platform**: CI runs on `ubuntu-latest`, `windows-latest`, `macos-latest` via GitHub Actions.

---

## 4. Implementation phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Data models: `ApmPackage`, `ApmSource`, `ApmConfig`, `ApmLock` | Done |
| 2 | Microkernel: `PluginRegistry`, `IRepositoryStrategy`, `IProviderStrategy`, `bootstrap.ts` | Done |
| 3 | Repository strategies: `LocalRepositoryStrategy`, `GitHubRepositoryStrategy` | Done |
| 4 | Provider strategies: `StandardProviderStrategy`, `ClaudeProviderStrategy`, `VscodeProviderStrategy` | Done |
| 5 | Core managers: `ApmConfigManager`, `ApmLockManager`, `ApmManifestManager` | Done |
| 6 | Core orchestrators: `ApmRegistry`, `ApmInstaller` | Done |
| 7 | CLI commands: `init`, `install`, `uninstall`, `list`, `status`, `outdated`, `manifest`, `refresh` | Done |
| 8 | npm source type (`NpmRepositoryStrategy`) | Pending |
| 9 | Windsurf provider (`WindsurfProviderStrategy`) | Pending |
| 10 | Hook management: install/uninstall lifecycle for hook scripts | Pending |
| 11 | Private GitHub support: token or SSH credential handling | Pending |
| 12 | Comprehensive test suite (unit + integration + cross-platform CI) | Pending |

---

## 5. Migration plan

All configuration files (`apm.config.json`, `apm.lock.json`) are machine-local and gitignored. There is no shared state to migrate. Upgrading APM is equivalent to updating the npm package; existing config files remain compatible as long as `schemaVersion` is respected.

Breaking changes to the config schema will increment `schemaVersion`. A migration notice will be emitted on startup when the file version is older than the running binary.

---

## 6. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `git` not on PATH for GitHub sources | Medium | Medium | `assertGit()` check before any clone; clear error with install link |
| GitHub clone fails (network, rate limit, private repo) | Medium | Medium | Partial clone removed on failure; error message names source and URL |
| Windows path separator mismatch in strategy logic | Medium | High | All path operations use `path.join`/`path.resolve`; no string concatenation |
| Cache grows unbounded (`~/apm.cache/`) | Low | Low | `apm refresh` replaces via `git pull`; no growth. Manual `rm -rf ~/apm.cache/` resets fully |
| Source overwrite (standard local = source dir) | High | High | `guardSourceOverwrite()` warns before install; does not block (--dir redirects) |
| `apm.json` fast-path stale after skill update | Medium | Low | `apm manifest` regenerates; `apm list` falls back to live scan if manifest absent |
| `updated` date comparison breaks for non-ISO dates | Low | Medium | Frontmatter parser normalizes to string; comparison is lexicographic — ISO dates sort correctly |
| Community source layouts diverge from expected `skillsPath` | Medium | Medium | `skillsPath` is per-source config; each community source has correct path in default config |

---

## 7. Alternatives considered

### Alternative A: Hardcoded provider branches (no strategy pattern)

`ApmInstaller` could contain `if (provider === 'claude') { ... } else if (provider === 'vscode') { ... }` branches for each provider.

Rejected because: adding a new provider requires modifying `ApmInstaller`, `ApmRegistry`, and the CLI. The strategy pattern keeps each provider self-contained in one file and reduces the change surface to zero for new additions.

### Alternative B: npm packages as the distribution format

Skills could be published as npm packages with `files: ['.agents/skills/ks-*/']` and installed via `npm install`. The `node_modules/` tree would hold skill files.

Rejected because: npm is designed for code, not context files. It provides no mechanism for provider-aware install path routing, SKILL.md to .mdc conversion, or manifest.json generation. Skills would land in `node_modules/`, not in `~/.claude/skills/`. The per-skill overhead of a `package.json` per skill adds noise without benefit.

### Alternative C: Single config + lock merged into one file

`apm.json` could contain both source configuration and installed state.

Rejected because: config and state have different lifecycles. Config is written by the developer and shared across operations. State changes after every install. Merging them creates merge conflicts if the file is ever committed, and makes the single-responsibility principle harder to maintain.

### Alternative D: Monolithic registry (no IRepositoryStrategy)

`ApmRegistry` could contain inline methods for local and GitHub sources, with an `if (source.type === 'github')` branch.

Rejected because: the same argument as Alternative A applies. The GitHub strategy's clone, cache, and staleness logic is significant enough to warrant isolation. The composition pattern (`GitHubRepositoryStrategy` delegates local scanning to `LocalRepositoryStrategy`) would be impossible in a monolithic model.

### Alternative E: File-level locking (one lock entry per file, not per package)

`apm.lock.json` could track individual files rather than package directories.

Rejected because: a skill is an atomic unit (a directory with SKILL.md and references/). Tracking at the file level increases lock file size by 10-50x with no benefit, since outdated detection only needs the `updated` date from SKILL.md.

---

## 8. Architecture Decision Records

### ADR-001: Microkernel with strategy pattern for providers and repositories

**Date**: 2026-04 | **Status**: Accepted

**Context**: APM must support an open-ended set of AI tool providers (claude, cursor, windsurf, jetbrains) and source types (local, github, npm, gitlab). Hardcoding each combination produces a combinatorial explosion of branches.

**Decision**: Use a Microkernel (`PluginRegistry`) with two separate extension points (`IRepositoryStrategy`, `IProviderStrategy`). All strategies are registered at startup via `bootstrap()`. Core orchestrators (`ApmRegistry`, `ApmInstaller`) dispatch through the registry.

**Consequences**: Adding a new provider requires creating one file implementing `IProviderStrategy` and one line in `bootstrap.ts`. Existing code is unchanged. The trade-off is one level of indirection vs. direct method calls; this is acceptable given the extensibility requirement.

---

### ADR-002: `pkg.localPath` as a runtime-only fast-path

**Date**: 2026-04 | **Status**: Accepted

**Context**: Package path resolution differs by source type. A local package resolves instantly; a GitHub package requires a cache lookup. If every install call re-derives the path from source config, GitHub paths re-run expensive lookups.

**Decision**: `list()` sets `pkg.localPath` on every returned package. The installer uses it directly if present, falling back to `strategy.getLocalPath()` only when it is absent (e.g., packages deserialized from apm.json). `localPath` is never serialized.

**Consequences**: Path resolution is O(1) for packages returned by `list()`. The fallback path adds one registry lookup per package when `localPath` is absent. `sourceRef` must always be serialized to enable the fallback.

---

### ADR-003: `~/apm.cache/` as user-scoped cache, not project-scoped

**Date**: 2026-05 | **Status**: Accepted

**Context**: GitHub clones could be stored inside the project (`.apm-cache/`) or in the user home directory.

**Decision**: Store at `~/apm.cache/{source.name}/`. The directory name uses a dot-separated name (`apm.cache`) compatible with all target platforms; it does not start with a dot to remain visible on Windows without special tooling.

**Consequences**: Multiple projects sharing the same GitHub source share one clone; `apm refresh` in any project updates the shared cache. The risk of staleness is accepted: the 24-hour threshold and explicit `apm refresh` command give the user full control. Cache must be listed in `.gitignore` instructions (it lives outside the project root so it cannot be accidentally committed anyway).

---

## 9. Open questions

| # | Question | Owner | Due |
|---|---|---|---|
| 1 | Should `schemaVersion` validation be enforced at read time (reject unknown versions) or advisory only? | Engineering | Next sprint |
| 2 | Should `apm refresh` warn when a cached source is stale at `install` time, or auto-refresh? | PM + Engineering | Next sprint |
| 3 | Should `apm.config.json` be committable with a `--shared` flag that strips machine-local fields? | PM | v2 |
| 4 | Should the `npm` source type use the local npm registry or npmjs.com? | Engineering | Phase 8 |
| 5 | How should private GitHub sources be authenticated — SSH keys, HTTPS tokens, or both? | Engineering + Security | Phase 11 |

---

## 10. Estimates

| Phase | Scope | Estimate | Status |
|---|---|---|---|
| 1-7 | Core architecture + all CLI commands | — | Done |
| 8 | `NpmRepositoryStrategy` | 2 days | Pending |
| 9 | `WindsurfProviderStrategy` | 1 day | Pending |
| 10 | Hook management (install/uninstall) | 3 days | Pending |
| 11 | Private GitHub authentication | 3 days | Pending |
| 12 | Full test suite (unit + integration + CI) | 4 days | Pending |
| **Total remaining** | | **~13 days** | |
