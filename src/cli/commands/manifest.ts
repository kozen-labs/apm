import { ApmManifestManager } from '../../core/manifest';
import * as log from '../../utils/log';

/** Scan source directories and write/refresh `.agents/apm.json`. */
export function manifestCommand(projectRoot: string): void {
  log.section('Generating .agents/apm.json');
  const manager  = new ApmManifestManager(projectRoot);
  const manifest = manager.generate();
  manager.write(manifest);

  const { skills, agents } = manifest.packages;
  log.ok(`apm.json written — ${skills.length} skills, ${agents.length} agents`);
  console.log();
}
