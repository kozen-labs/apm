# 📦 Kozen APM: Agent Package Manager

APM is a Command Line Interface (CLI) tool that installs, updates, and manages AI context files (skills, agents, hooks, and context documents) across multiple AI coding tools from a single command.

```bash
npx kozen --moduleLoad=@kozen/apm --action=apm:install --provider=claude --scope=global
```

---

## 🧩 Concepts

### Packages

A **package** is a directory of context files that an AI tool loads during a session. APM classifies each package along two dimensions:

| Dimension | Values |
|---|---|
| **Type** | `skill`, `agent`, `hook`, `context` |
| **Provider** | `claude`, `cursor`, `vscode`, `windsurf`, `standard` |

**Skills** are instructional Markdown files that give an AI tool domain knowledge or behavioral rules. **Agents** are autonomous sub-agent definitions. **Hooks** are lifecycle scripts. **Context** files are general-purpose documents loaded into the AI session.

### Providers

Each provider maps packages to the directory and file format that the corresponding AI tool reads at startup:

| Provider | Install path (local scope) | Format |
|---|---|---|
| `standard` | `.agents/skills/` or `.agents/agents/` | Copies the package directory as-is |
| `claude` | `.claude/skills/` or `.claude/agents/` | Copies the package directory |
| `cursor` | `.cursor/rules/<package>.mdc` | Converts to Markdown Components (MDC) with frontmatter |
| `vscode` | `.vscode/skills/<package>/` | Copies the package directory |
| `windsurf` | `.windsurfrules` | Appends content to the rules file |

The `.mdc` format is Cursor's Markdown Components (MDC) convention, which wraps content with a YAML frontmatter block containing metadata such as description and glob patterns.

The `--scope=global` flag installs into the user's home directory instead of the current project.

### Sources

APM fetches packages from three source types, all configured in `apm.pack.json`:

| Source | Description |
|---|---|
| `local` | A local directory on disk (`.agents/` by default) |
| `github` | A GitHub repository cloned into a local cache |
| `npm` | An npm package installed in `node_modules` |

### Lock file

`apm.lock.json` records the exact set of installed packages per provider and scope, similar to `package-lock.json` but for AI context files. Commit this file to version control to keep team installs reproducible.

---

## ⚡ Quick start

**Requires Node.js 18+.**

### Install

```bash
npm install @kozen/apm
```

### Initialize a project

Creates `apm.pack.json` (source configuration) and `apm.lock.json` (install state):

```bash
npx kozen --moduleLoad=@kozen/apm --action=apm:setup
```

### List available packages

```bash
# List available skills
npx kozen --moduleLoad=@kozen/apm --action=apm:list --component=skill

# List available agents
npx kozen --moduleLoad=@kozen/apm --action=apm:list --component=agent
```

### Install packages

```bash
# Install all skills into Claude Code (project scope)
npx kozen --moduleLoad=@kozen/apm --action=apm:install --component=skill --provider=claude --scope=local

# Install specific packages by name (comma-separated)
npx kozen --moduleLoad=@kozen/apm --action=apm:install --packages=ks-mongodb-core,ks-security-patterns-and-principles --provider=claude --scope=global

# Install agents into Cursor
npx kozen --moduleLoad=@kozen/apm --action=apm:install --component=agent --provider=cursor --scope=local
```

### Check for updates

```bash
# Show all installed packages and whether each is outdated
npx kozen --moduleLoad=@kozen/apm --action=apm:status

# Show only packages with newer versions available
npx kozen --moduleLoad=@kozen/apm --action=apm:outdated
```

### Uninstall

```bash
# Remove specific packages
npx kozen --moduleLoad=@kozen/apm --action=apm:uninstall --packages=ks-mongodb-core --provider=claude --scope=local

# Remove all installed packages for a provider and scope
npx kozen --moduleLoad=@kozen/apm --action=apm:uninstall --provider=claude --scope=local
```

### Refresh remote sources

After adding a `github` or `npm` source to `apm.pack.json`, pull the latest content:

```bash
npx kozen --moduleLoad=@kozen/apm --action=apm:refresh
```

---

## ⚙️ Command reference

| Action | Description | Key options |
|---|---|---|
| `apm:help` | Show usage and list of actions | — |
| `apm:setup` | Initialize `apm.pack.json` and `apm.lock.json` | `--yes`, `--force` |
| `apm:install` | Install packages into a provider | `--packages`, `--component`, `--provider`, `--scope`, `--dir` |
| `apm:uninstall` | Remove installed packages | `--packages`, `--component`, `--provider`, `--scope`, `--dir` |
| `apm:list` | List all available packages from configured sources | `--component` |
| `apm:status` | Show installed packages across all providers | `--component` |
| `apm:outdated` | Show packages with newer versions available | `--component` |
| `apm:manifest` | Scan source directories and write `.agents/apm.json` | — |
| `apm:refresh` | Pull latest from remote sources (github, npm) | `--source` |

### Common options

| Option | Default | Description |
|---|---|---|
| `--component` | `skill` | Component type: `skill`, `agent`, `hook`, `context`, or `all` |
| `--provider` | `standard` | Target AI tool: `standard`, `claude`, `cursor`, `vscode`, `windsurf` |
| `--scope` | `local` | Install scope: `local` (current project) or `global` (home directory) |
| `--packages` | _(all)_ | Comma-separated package names. Omit to operate on all packages. |
| `--config` | _(auto-detected)_ | Path to `apm.pack.json`. Project root is derived as its parent directory. Overrides `KOZEN_APM_CONFIG` env var. |
| `--projectRoot` | _(auto-detected)_ | Absolute path to the project root. Ignored when `--config` is set. |

The `KOZEN_APM_CONFIG` environment variable is the persistent equivalent of `--config`: set it in `.env` or CI to point to a shared or non-standard config location. `--config` on the command line always takes precedence over `KOZEN_APM_CONFIG`.

---

## 🔌 MCP server

APM can expose all its actions as Model Context Protocol (MCP) tools, making them available to any AI agent that supports MCP:

```json
{
  "mcpServers": {
    "kozen-apm": {
      "command": "npx",
      "args": ["kozen", "--moduleLoad=@kozen/apm", "--type=mcp"],
      "env": { "KOZEN_LOG_LEVEL": "NONE" }
    }
  }
}
```

> `KOZEN_LOG_LEVEL=NONE` is required to prevent console output from corrupting the JSON Remote Procedure Call (JSON-RPC) stream.

The following MCP tools are registered:

| Tool | Description |
|---|---|
| `kozen_apm_install` | Install packages into a provider |
| `kozen_apm_uninstall` | Remove installed packages |
| `kozen_apm_list` | List all available packages |
| `kozen_apm_status` | Show installed packages across all providers |
| `kozen_apm_outdated` | List packages with newer versions available |

---

## 🗂️ Configuration: `apm.pack.json`

`apm:setup` generates this file with all community sources pre-configured. Enable the sources you want by setting `"enabled": true` and running `apm:refresh`.

```json
{
  "defaultProvider": "standard",
  "defaultScope": "global",
  "sources": [
    {
      "type": "local",
      "name": "local",
      "path": ".",
      "description": "Local project .agents/ directory",
      "enabled": true
    },
    {
      "type": "github",
      "name": "kozen",
      "url": "https://github.com/kozen-labs/agentic",
      "ref": "main",
      "skillsPath": ".agents/skills",
      "agentsPath": ".agents/agents",
      "description": "Official Kozen community skill and agent registry",
      "enabled": false
    },
    {
      "type": "skills-sh",
      "name": "vercel-skills",
      "url": "https://github.com/vercel-labs/skills",
      "namespace": "vercel",
      "skillsPath": "skills",
      "description": "Vercel Labs skills (skills.sh-compatible format)",
      "enabled": false
    },
    {
      "type": "awesome-claude",
      "name": "awesome-claude",
      "url": "https://awesomeclaude.ai/api/skills.json",
      "description": "AwesomeClaude.ai curated skill catalog",
      "enabled": false
    }
  ]
}
```

### Source types

| Type | Description |
|---|---|
| `local` | Local filesystem directory. The default source for packages in your project. |
| `github` | GitHub repository in APM directory format (`.agents/skills/`, `.agents/agents/`). |
| `npm` | npm package that bundles a `.agents/` tree. |
| `skills-sh` | GitHub repository in skills.sh flat-file format (one `.md` file per skill). APM virtualises each file into a directory before installation. |
| `awesome-claude` | AwesomeClaude.ai curated catalog. Fetches a JSON catalog on `refresh` and clones individual skill repos on install. |

### Default provider and scope

The `defaultProvider` and `defaultScope` fields control the install target when `--provider` and `--scope` are omitted from a command.

The two values are coupled: the correct pairing depends on where you want skills to land.

| `defaultScope` | Recommended `defaultProvider` | Where packages are installed |
|---|---|---|
| `global` | `standard` | `~/.agents/skills/` (provider-agnostic home directory) |
| `global` | `claude` | `~/.claude/skills/` (Claude Code global directory) |
| `local` | `claude` | `.claude/skills/` inside the auto-detected project root |
| `local` | `cursor` | `.cursor/rules/` inside the auto-detected project root |

When `scope` is `local`, APM resolves the project root by walking up the file tree from the working directory until it finds a `.agents/` directory or an `apm.pack.json` file. Pass `--config=<path>` (or set `KOZEN_APM_CONFIG`) to use a config file in a non-standard location; the project root is then the directory containing that file.
```

---

## 🏗️ Architecture

APM uses a microkernel and strategy pattern. The core layer contains pure business logic with no framework dependencies. Plugins extend behavior along three independent axes.

- **Core** (`src/core/`): pure business logic (registry, installer, lock manager, manifest manager, config manager). No framework dependencies; fully tested.
- **Plugins** (`src/plugins/`): three axes of extension:
  - **Repositories**: how packages are fetched (`local`, `github`, `npm`)
  - **Providers**: how packages are written to disk (`standard`, `claude`, `cursor`, `vscode`, `windsurf`)
  - **Components**: how each component type is handled (`skill`, `agent`, `hook`, `context`)
- **Services** (`src/services/`): thin Inversion of Control (IoC) wrappers over the core classes for Kozen engine integration.
- **Controllers** (`src/controllers/`): CLI and MCP entry points dispatched by the Kozen engine.

APM is published as a [Kozen](https://www.npmjs.com/package/@kozen/engine) module. The same package runs as a CLI action, an MCP server, or an importable library.

---

## 💻 Development

```bash
# Install dependencies
npm install

# Type-check
npm run type-check

# Run tests
npm test

# Build
npm run build

# Run locally (CLI)
npm run dev
```

---

## 📄 License

MIT

---

## 📚 References

- [Kozen Engine (@kozen/engine)](https://www.npmjs.com/package/@kozen/engine)
- [Model Context Protocol specification](https://modelcontextprotocol.io/)
- [Agent Skills Standard](https://agentskills.io/home)
- [MongoDB Agent Skills](https://github.com/mongodb/agent-skills)
- [skills.sh — skill registry and CLI for AI tools](https://skills.sh/)
- [AwesomeClaude.ai — curated Claude skill directory](https://awesomeclaude.ai/awesome-claude-skills)
- [Graphify: Knowledge Graphs for AI Coding Assistants](https://graphify.net/)
- [LangChain Skills](https://www.langchain.com/blog/langchain-skills)
- [Marketplace for ai tools](https://github.com/10gen/core-platforms-ai-tools)
- [Agent Development Kit (ADK)](https://github.com/google/adk-python)
- [Agentgateway is an open source proxy built on AI-native protocols (MCP & A2A) ](https://github.com/agentgateway/agentgateway)
- [Skill validator](https://github.com/agent-ecosystem/skill-validator)
- [Node.js](https://nodejs.org/)
