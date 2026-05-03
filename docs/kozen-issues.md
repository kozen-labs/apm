# Kozen Engine — Open Issues

Issues identified during the integration of `@kozen/apm` into the Kozen Engine framework.
Each issue includes: the problem, the impact on APM, the workaround used in the current
implementation, and the resolution path once the issue is fixed upstream.

---

## KZN-001 — [Feature] Enumerate registered services by token prefix

**Status**: Open  
**Target**: `@kozen/engine`  
**Priority**: High — blocks full IoC migration of PluginRegistry

### Problem

The Kozen IoC container (Awilix) has no API to list all registered tokens that match a
given prefix (e.g., `IoC.listTokens('apm:repo:*')`). The only way to find a service is
to know its exact token and call `resolve(token)`.

### Impact on APM

APM needs to enumerate all registered strategies at runtime:
- `listRepositoryTypes()` — list available source types (`local`, `github`, `npm`)
- `listProviderNames()` — list available install targets (`standard`, `claude`, `cursor`, …)
- `listComponentTypes()` — list registered component types (`skill`, `agent`, …)

Without enumerate support, these three `Map<string, T>` registries in `PluginRegistry.ts`
cannot be replaced by the Kozen IoC container.

### Workaround (current implementation)

`PluginRegistry.ts` (three `Map<string, T>` registries) coexists with Kozen IoC:
- Kozen IoC manages: services, controllers, `projectRoot` value
- `PluginRegistry` manages: repository/provider/component strategies

`bootstrap()` is called from `ApmModule.register()` to populate the Maps before any
service tries to look up a strategy. This keeps the existing microkernel working while
Kozen IoC manages the service layer.

### Resolution (when fixed upstream)

When `@kozen/engine` exposes `container.listTokens(prefix?: string): string[]`:

1. Remove `PluginRegistry.ts` Maps for providers, repositories, components
2. Register each strategy as an IoC token: `apm:repo:github`, `apm:provider:claude`, etc.
3. Replace `getRepository('github')` with `IoC.resolve('apm:repo:github')`
4. Replace `listProviderNames()` with `IoC.listTokens('apm:provider:')`
5. Remove `src/core/PluginRegistry.ts` and `src/core/bootstrap.ts`

**Files to update**: `src/core/PluginRegistry.ts`, `src/core/bootstrap.ts`,
`src/configs/ioc.json`, `src/plugins/repositories/local.ts`,
`src/services/ApmRegistryService.ts`, `src/services/ApmInstallerService.ts`

---

## KZN-002 — [Enhancement] Document dynamic value registration in register()

**Status**: Open  
**Target**: `@kozen/engine` documentation (`references/module-development.md`)  
**Priority**: Medium — workaround works, but pattern is undiscovered

### Problem

The `register(config, opts)` method can return `IDependency` entries with `type: 'value'`
alongside the standard `type: 'class'` entries loaded from JSON config files. This allows
registering runtime-computed values (strings, objects) as IoC tokens. The pattern works
correctly in Awilix but is not documented in the Kozen module development guide.

No existing Kozen module (`@kozen/secret`, `@kozen/trigger`, `@kozen/iam-rectification`)
uses this pattern, leaving developers without a reference implementation.

### Impact on APM

APM needs to inject `projectRoot` (computed from `findProjectRoot()` at module load time)
into every service. `projectRoot` cannot be placed in `ioc.json` because it is a
filesystem path computed at runtime, not a static configuration value.

### Workaround (current implementation)

In `ApmModule.register()`, a dynamic entry is added programmatically:

```typescript
const projectRoot = findProjectRoot();
const dynamic: Record<string, IDependency> = {
  'apm:project-root': {
    key:    'apm:project-root',
    target: 'apm:project-root',
    type:   'value',
    value:  projectRoot,
  } as IDependency,
};
let dep = { ...iocJson, ...dynamic, ...(isCliType ? cliJson : {}), ...(isMcpType ? mcpJson : {}) };
dep = this.fix(dep);
```

Services declare the dependency in `ioc.json`:
```json
{ "key": "projectRoot", "target": "apm:project-root", "type": "ref" }
```

This works correctly today and requires no upstream changes to the engine code.

### Resolution (when fixed upstream)

Add a dedicated section "Dynamic value registration" to `references/module-development.md`
with the above pattern as a worked example. No code changes needed in APM — the current
implementation is already the correct pattern.

---

## KZN-003 — [Bug/UX] MCP mode silently corrupts output if console logging is active

**Status**: Open  
**Target**: `@kozen/engine` — `MCPApplication` or `CLIApplication` startup  
**Priority**: High — causes invisible failures for MCP users

### Problem

The MCP protocol uses stdout as its JSON-RPC transport channel. Any non-JSON-RPC text
written to stdout corrupts the stream. When `--type=mcp` is used, Kozen's console logger
still writes to stdout unless `KOZEN_LOG_LEVEL=NONE` (or `KOZEN_LOG_CONSOLE_ENABLED=false`)
is explicitly set.

This failure is silent: the MCP client receives malformed data and disconnects, but no
error message explains that console logging was the cause.

### Impact on APM

`ApmCLIController` uses chalk-based logging extensively (`log.info`, `log.ok`, `log.banner`).
When running as MCP, any logging to stdout breaks the connection. New users of APM's MCP
integration will encounter this failure without a clear diagnostic.

### Workaround (current implementation)

Two layers of protection in `@kozen/apm`:

1. `ApmMCPController` uses only `this.logger` (Kozen's structured logger) — never direct
   `console.log` or chalk output.
2. Documentation in `docs/kozen-integration.md` explicitly requires `KOZEN_LOG_LEVEL=NONE`
   in MCP server config.

The `cfg/config.json` for MCP mode will include:
```json
{ "type": "mcp", "logLevel": "NONE" }
```

### Resolution (when fixed upstream)

When `MCPApplication.start()` automatically suppresses console output:

1. Remove the `KOZEN_LOG_LEVEL=NONE` requirement from APM's MCP docs.
2. Remove the defensive `logLevel` setting from `cfg/config.json`.
3. Update `docs/kozen-integration.md` to remove the manual workaround note.

**Suggested engine change**: In `MCPApplication.start()`, set console log level to `NONE`
automatically, or route logger output to stderr instead of stdout when `type === 'mcp'`.

---

## KZN-004 — [Feature] Positional CLI argument support

**Status**: Open  
**Target**: `@kozen/engine` — `CLIApplication` / `KzController` arg parsing  
**Priority**: Medium — affects UX but has functional workaround

### Problem

Kozen's CLI parses all arguments as `--key=value` pairs. There is no support for
positional arguments (unnamed values after the action, e.g.,
`kozen --action=apm:install mongodb/ks-core ks-core-agents`).

npm, git, and most CLI tools pass target names as positional arguments, not as
a named flag (`--packages=a,b,c`).

### Impact on APM

APM commands like `apm install mongodb/ks-core` and `apm uninstall ks-analytics`
use positional args for package names. These cannot be mapped directly to Kozen's
`--action=apm:install` invocation model.

Users must write:
```bash
# Instead of: apm install mongodb/ks-core ks-analytics
npx kozen --action=apm:install --packages=mongodb/ks-core,ks-analytics
```

### Workaround (current implementation)

`--packages` flag accepts a comma-separated list of package names:

```bash
npx kozen --moduleLoad=@kozen/apm --action=apm:install \
  --packages=mongodb/ks-core,ks-analytics --provider=claude
```

In `ApmCLIController.install()`:
```typescript
const packages = (this.args?.packages as string ?? '')
  .split(',').map(s => s.trim()).filter(Boolean);
```

The backward-compatible `bin/apm` shim translates positional args to `--packages`:
```bash
# apm install mongodb/ks-core → kozen --action=apm:install --packages=mongodb/ks-core
```

### Resolution (when fixed upstream)

When `@kozen/engine` supports positional args (e.g., `this.args?._` as string[]):

1. Replace `--packages=a,b` with positional `_` array in `ApmCLIController`.
2. Update `docs/kozen-integration.md` with new syntax.
3. Keep `--packages` as a deprecated alias for backward compatibility.

---

## KZN-005 — [Enhancement] register() should receive parsed CLI args

**Status**: Open  
**Target**: `@kozen/engine` — `IModule.register()` signature  
**Priority**: Medium — workaround functional but imprecise

### Problem

`register(config: IConfig | null, opts?: any)` is called during module loading to build
the IoC dependency map. At this point, CLI arguments have already been parsed by the engine
but are not passed to `register()`. The `opts` parameter is typed as `any` and its content
is undocumented — it may or may not carry args depending on the engine version.

Modules that need to register IoC values derived from CLI args (e.g., `--projectRoot=/path`)
must either:
- Compute them independently (ignoring the user's explicit CLI arg), or
- Read `process.argv` directly (bypassing Kozen's arg parser)

### Impact on APM

`projectRoot` is computed by `findProjectRoot()` (auto-detect from filesystem). When a
user explicitly passes `--projectRoot=/custom/path`, `ApmModule.register()` cannot see
that flag — so the IoC value for `apm:project-root` will be the auto-detected path, not
the user's override.

Controllers can override via `this.args?.projectRoot` at action time, but the IoC value
is already set.

### Workaround (current implementation)

Two-level resolution in `ApmCLIController`:

```typescript
// Controller level: CLI arg takes precedence over IoC-registered value
const projectRoot = (this.args?.projectRoot as string | undefined)
  ?? await this.assistant?.resolve<string>('apm:project-root')
  ?? findProjectRoot();
```

For services, the IoC-injected `projectRoot` is used for standard cases (auto-detect
is correct 99% of the time). The `--projectRoot` override works at controller level
for one-off invocations.

`ApmModule.register()` reads `process.argv` directly as a best-effort fallback:
```typescript
const argRoot = process.argv.find(a => a.startsWith('--projectRoot='))?.split('=')[1];
const projectRoot = argRoot ?? findProjectRoot();
```

### Resolution (when fixed upstream)

When `register(config, opts)` receives parsed args in `opts`:

```typescript
public async register(config: IConfig | null, opts?: { args?: IArgs }): Promise<...> {
  const projectRoot = opts?.args?.projectRoot ?? findProjectRoot();
  // ...
}
```

1. Remove the `process.argv` parsing from `ApmModule.register()`.
2. Remove the controller-level `findProjectRoot()` fallback.
3. All services receive the correct `projectRoot` from first IoC registration.

**Files to update**: `src/index.ts` (`ApmModule.register()`),
`src/controllers/ApmCLIController.ts` (simplify root resolution).

---

## Summary table

| ID | Type | Priority | Status | Blocks full IoC? | Workaround |
|---|---|---|---|---|---|
| KZN-001 | Feature | High | Open | Yes — PluginRegistry Maps persist | Maps coexist with Kozen IoC |
| KZN-002 | Docs | Medium | Open | No | Pattern used, undocumented |
| KZN-003 | Bug/UX | High | Open | No | `KOZEN_LOG_LEVEL=NONE` + docs |
| KZN-004 | Feature | Medium | Open | No | `--packages=a,b` flag |
| KZN-005 | Enhancement | Medium | Open | No | `process.argv` + controller fallback |
