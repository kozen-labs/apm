import type { IApmPackage } from './IApmPackage';

/** Root structure of `.agents/apm.json`. */
export interface IApmManifest {
  schemaVersion: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  packages: {
    skills: IApmPackage[];
    agents: IApmPackage[];
    hooks?: IApmPackage[];
  };
}
