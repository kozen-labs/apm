/**
 * bootstrap() was previously used to populate the PluginRegistry with
 * repositories, providers, and components via new().
 *
 * All registrations are now declared in src/configs/ioc.json and resolved
 * through the Kozen IoC container at runtime. This file is kept as a no-op
 * for backwards compatibility with any external callers.
 *
 * @deprecated Use the Kozen IoC container instead.
 */
export function bootstrap(): void { /* no-op — IoC handles all registrations */ }
