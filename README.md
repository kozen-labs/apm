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

APM fetches packages from three source types, all configured in `apm.config.json`:

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

Creates `apm.config.json` (source configuration) and `apm.lock.json` (install state):

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

After adding a `github` or `npm` source to `apm.config.json`, pull the latest content:

```bash
npx kozen --moduleLoad=@kozen/apm --action=apm:refresh
```

---

## ⚙️ Command reference

| Action | Description | Key options |
|---|---|---|
| `apm:help` | Show usage and list of actions | — |
| `apm:setup` | Initialize `apm.config.json` and `apm.lock.json` | `--yes`, `--force` |
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
| `--projectRoot` | _(auto-detected)_ | Absolute path to the project root |

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

## 🗂️ Configuration: `apm.config.json`

`apm:setup` generates this file. The following example registers all three source types:

```json
{
  "sources": [
    {
      "type": "local",
      "name": "local",
      "path": ".agents"
    },
    {
      "type": "github",
      "name": "mongodb-skills",
      "repo": "mongodb/agent-skills",
      "branch": "main",
      "path": ".agents"
    },
    {
      "type": "npm",
      "name": "my-org-skills",
      "package": "@my-org/agent-skills"
    }
  ]
}
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
- [Node.js](https://nodejs.org/)
