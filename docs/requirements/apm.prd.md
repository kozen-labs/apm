# PRD: APM — Agent Package Manager

## Status
Draft
Version: 1.0   Author: Antonio Membrides Espinosa   Last updated: 2026-05-03

---

## 1. Background and problem statement

AI-assisted development tools — Claude Code, Cursor, Windsurf, Aider, GitHub Copilot — rely on context files to provide domain-specific guidance during coding sessions. These files take several forms: skills (SKILL.md bundles with supporting references), agents (.md definitions that run as sub-processes), and hooks (scripts triggered by tool events). Collectively they represent curated, structured knowledge that shapes how the AI reasons about a codebase.

Today, teams and individual developers manage these files manually. A developer copies directories from a reference repository, an AI tool reads whatever happens to be in the right directory, and version drift is discovered only when an AI response misses something critical. There is no tooling equivalent to npm, pip, or cargo for AI development artifacts.

The consequences are predictable:

- **Installation friction**: installing 28 skills into Claude Code, Cursor, and a standard AGENTS.md target requires three separate manual copy operations, each with different directory layouts.
- **Invisible drift**: there is no way to know whether an installed skill is current without manually diffing files against the source.
- **No team alignment**: different developers install different subsets of skills with no record of what each machine has.
- **Vendor lock-in at the filesystem level**: a skill installed for Claude Code has a different format than one installed for Cursor; switching tools requires manual conversion.

APM (Agent Package Manager) solves this with a CLI that handles discovery, installation, update detection, and state tracking for AI development context files across multiple AI tools and project scopes.

---

## 2. Goals and success criteria

| Goal | Metric | Target |
|---|---|---|
| One-command install | Time from `npm install` to first skill active in Claude Code | < 2 minutes |
| Cross-tool coverage | Providers supported at launch | claude, standard (AGENTS.md), vscode/cursor |
| Team alignment | Commands needed to sync a new developer to team skill set | 2 (`apm init`, `apm install`) |
| Drift detection | Outdated skills identified without live scan | Immediate, from `apm.lock.json` |
| Extensibility | New provider added without modifying core classes | 1 new file implementing `IProviderStrategy` |
| Extensibility | New source type added without modifying core classes | 1 new file implementing `IRepositoryStrategy` |

---

## 3. User personas and use cases

### Persona: Individual developer

- **Context**: works alone or on a small team; uses Claude Code or Cursor daily; has a library of skills for MongoDB, security, and software architecture.
- **Primary use case**: install all skills globally once and have them available in every AI session, for every project.
- **Pain point**: manually copying skill directories after every skill update; no way to know which installed skills are outdated.

### Persona: Team tech lead

- **Context**: responsible for consistency across a 5-15 person engineering team; maintains a shared GitHub repository of team-authored skills.
- **Primary use case**: define a canonical skill set in a shared repo; every developer runs two commands to get the latest version.
- **Pain point**: no single source of truth for "what skills should the team have installed"; no mechanism to detect and remediate drift.

### Persona: Skill author

- **Context**: has written domain knowledge packaged as a `ks-*` skill directory; wants to distribute it to teammates or the wider community.
- **Primary use case**: publish the skill in a GitHub repository with a standard layout; consumers run `apm refresh` and `apm install` to receive it.
- **Pain point**: no standard layout or tooling; consumers must know the exact directory structure.

### Persona: AI tool integrator (future)

- **Context**: building or maintaining an AI coding assistant with a custom context-file format.
- **Primary use case**: register a new `IProviderStrategy` so APM can install skills to the tool's expected location and format.
- **Pain point**: every new tool requires changes to every existing installer script.

---

## 4. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | `apm init` creates `apm.config.json` and an empty `apm.lock.json` at the project root | Must Have |
| FR-02 | `apm init` is interactive: prompts for default provider, default scope, and community source activation | Must Have |
| FR-03 | `apm init --yes` accepts all defaults without prompts | Must Have |
| FR-04 | `apm init --force` overwrites an existing `apm.config.json` | Should Have |
| FR-05 | `apm list` displays all available packages from all enabled sources, grouped by domain | Must Have |
| FR-06 | `apm install [names...]` installs named packages to the specified provider and scope; installs all if no names given | Must Have |
| FR-07 | `apm install` supports `--type skill\|agent\|all`, `--provider standard\|claude\|vscode`, `--scope local\|global`, `--dir <path>` | Must Have |
| FR-08 | `apm uninstall [names...]` removes installed packages from the specified provider and scope | Must Have |
| FR-09 | `apm status` scans all install locations and displays installed packages with outdated indicators | Must Have |
| FR-10 | `apm outdated` shows only packages where the installed version is behind the source version | Must Have |
| FR-11 | `apm refresh [source]` pulls the latest from GitHub sources; refreshes all GitHub sources if no name given | Must Have |
| FR-12 | `apm manifest` scans `.agents/skills/` and `.agents/agents/` and writes `.agents/apm.json` | Should Have |
| FR-13 | Local file-system sources (`type: local`) are supported | Must Have |
| FR-14 | GitHub repository sources (`type: github`) are supported via `git clone --depth=1` | Must Have |
| FR-15 | Claude provider installs to `.claude/skills/` (local) or `~/.claude/skills/` (global) and writes `manifest.json` | Must Have |
| FR-16 | Standard provider installs to `.agents/skills/` (local) or `~/.agents/skills/` (global) | Must Have |
| FR-17 | VSCode/Cursor provider converts `SKILL.md` to `.mdc` format and installs to `.cursor/rules/` (local) or `~/.cursor/rules/` (global) | Must Have |
| FR-18 | `apm.lock.json` is written after every install, uninstall, status, and outdated operation | Must Have |
| FR-19 | `apm.config.json` is created automatically with defaults on first use if absent | Should Have |
| FR-20 | Source namespacing prefixes package names (e.g. `mongodb/ks-core`) to avoid collisions across sources | Should Have |
| FR-21 | Single-resource repositories (repo root is one skill) are supported via `singleResource: true` | Should Have |
| FR-22 | `apm` with no arguments opens an interactive menu | Could Have |
| FR-23 | Every install and uninstall operation writes a timestamped plain-text log to `tmp/apm/` | Could Have |
| FR-24 | `apm init` also scans `.agents/` and writes `.agents/apm.json` when the directory exists | Should Have |

---

## 5. Non-functional requirements

| Category | Requirement | Target |
|---|---|---|
| Performance | `apm list` against a local source | < 2 seconds |
| Performance | `apm install` (50 packages, claude, global) | < 5 seconds |
| Performance | GitHub clone | `--depth=1` shallow clone only |
| Compatibility | Operating systems | Windows 10+, macOS 12+, Ubuntu 20+ |
| Runtime | Node.js version | 18 or later; no binary native addons |
| Runtime | External CLI dependencies | `git` on PATH (only for `github` sources) |
| Security | `apm.config.json` and `apm.lock.json` not committed | Both listed in `.gitignore` instructions |
| Security | `apm.cache/` not committed | Listed in `.gitignore` instructions |
| Reliability | Source overwrite protection | Warn and abort before overwriting source with install target |
| Usability | Error messages | Every error includes the failing package name and a human-readable reason |
| Usability | `apm init --yes` | Fully non-interactive; suitable for CI bootstrap scripts |
| Observability | Lock file as audit trail | `apm.lock.json` records provider, scope, path, dates, and outdated status |

---

## 6. User stories

### US-01: Global install (individual developer)

As an individual developer,
I want to run `apm install --type skill --provider claude --scope global`
so that all skills are available in every Claude Code and Claude Desktop session without per-project setup.

```gherkin
Given I have run `npm install` in the project root
  And I have run `apm init --yes`
When I run `apm install --type skill --provider claude --scope global`
Then all skills are copied to `~/.claude/skills/`
 And `~/.claude/manifest.json` is written with correct paths
 And `apm.lock.json` records every installed skill with provider=claude, scope=global
 And the operation completes in under 5 seconds
```

### US-02: Team skill sync (tech lead)

As a tech lead,
I want team members to run two commands to receive the latest approved skills
so that every developer's AI session uses the same knowledge base.

```gherkin
Given `apm.config.json` contains a github source pointing to our team repository
  And the source has `"enabled": true`
When a developer runs `apm refresh team-skills`
 And then runs `apm install --type skill --provider claude --scope global`
Then the developer has the latest skills from the team repository
 And `apm.lock.json` reflects the installed versions
```

### US-03: Outdated detection

As a developer,
I want to run `apm outdated` and see which installed skills have a newer source version
so that I know when to update without manually checking file dates.

```gherkin
Given I have skills installed with provider=claude, scope=global
  And at least one source skill has an `updated` date newer than the installed copy
When I run `apm outdated --type skill`
Then the outdated skills are listed in a table with installed date and source date
 And up-to-date skills are not shown
 And `apm.lock.json` is updated with the current outdated status for all entries
```

### US-04: Project initialization

As a new team member,
I want to run `apm init` and answer a few prompts
so that `apm.config.json` is correctly configured without reading documentation.

```gherkin
Given neither `apm.config.json` nor `apm.lock.json` exists in the project root
When I run `apm init`
Then I am prompted for default provider and scope
 And I am asked whether to enable community sources
 And `apm.config.json` is written with my choices and the full community source list
 And `apm.lock.json` is written as an empty package list
 And if `.agents/` exists, `.agents/apm.json` is also written
```

---

## 7. Out of scope (v1)

- `npm` package sources (type reserved in `SourceType` but not implemented)
- GitLab, Bitbucket, or other git hosting providers
- Private GitHub repository support (authentication, SSH keys)
- Windsurf, JetBrains, or other AI tool providers (architecture supports them; not implemented)
- Hook management (`hooksPath` in config but no install/uninstall logic)
- Version pinning or semantic versioning (packages use date-based `updated` field only)
- Dependency resolution between packages
- Web-based skill registry or discovery portal
- GUI or web dashboard
- Package publishing workflows (APM is consumer-side only in v1)

---

## 8. Dependencies and integrations

| Dependency | Purpose | Risk |
|---|---|---|
| Node.js 18+ | Runtime | Low: widely available; checked at startup |
| `git` CLI | GitHub source cloning and refresh | Medium: must be on PATH; clear error if absent |
| Commander.js | CLI argument parsing | Low: stable, well-maintained |
| Inquirer.js | Interactive prompts | Low: stable, well-maintained |
| Chalk | Terminal color output | Low: cosmetic only; output still usable without color |
| Gray-matter | YAML frontmatter parsing | Low: stable; skills without valid frontmatter are skipped |
| GitHub (network) | GitHub source type | Medium: network required; clone fails gracefully with error message |

---

## 9. Timeline and milestones

| Milestone | Status | Notes |
|---|---|---|
| Core architecture (models, registry, installer, providers) | Complete | Microkernel + strategy pattern in place |
| CLI commands (init, install, uninstall, list, status, outdated, manifest, refresh) | Complete | All commands operational |
| Local and GitHub repository strategies | Complete | Shallow clone, cache, staleness detection |
| Claude, standard, and VSCode provider strategies | Complete | Including manifest.json writing for Claude |
| Lock file (`apm.lock.json`) | Complete | Written after every mutating operation |
| Config file (`apm.config.json`) with community sources | Complete | 5 community sources pre-configured, disabled by default |
| npm source type | Planned | IRepositoryStrategy implementation pending |
| Windsurf provider | Planned | IProviderStrategy implementation pending |
| Hook management | Planned | hooksPath in config; install logic not yet implemented |
| Private GitHub support (auth) | Planned | Requires credential management design |

---

## 10. Open questions and assumptions

| # | Question | Owner | Due |
|---|---|---|---|
| 1 | Should `apm.config.json` be committable as a team default, with personal overrides in a separate file? | Engineering | Next sprint |
| 2 | Should `apm refresh` auto-run before `apm install` when a GitHub source is stale (> 24h)? | PM + Engineering | Next sprint |
| 3 | Should the outdated threshold use ISO date comparison or semver? | Engineering | Next sprint |
| 4 | Should private GitHub repos be supported via SSH keys or token-based HTTPS? | Engineering + Security | v2 |
| 5 | Should APM support a `publish` command for uploading skills to a central registry? | PM | v2 |

**Assumptions:**

- Developers have Node.js 18+ available; APM does not bootstrap its own runtime.
- All skills use YAML frontmatter with at minimum `name`, `description`, `updated`, and `type` fields.
- The `updated` field is the canonical version identifier; semantic versioning is not required for v1.
- GitHub sources are publicly accessible; no authentication is needed in v1.
- `git` is available on developer machines that use GitHub sources; it is not required for local-only installs.
