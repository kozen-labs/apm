import type { IApmSource } from './IApmSource';

/** Schema for apm.pack.json. */
export interface IApmConfig {
  schemaVersion: string;
  sources: IApmSource[];
  /** Default provider used when --provider is omitted. */
  defaultProvider?: string;
  /** Default scope used when --scope is omitted. */
  defaultScope?: string;
}
