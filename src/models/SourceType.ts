/**
 * Supported source types.
 * local          — local filesystem directory.
 * github         — GitHub repository fetched via git clone.
 * npm            — npm package that bundles a .agents/ tree.
 * skills-sh      — skills.sh-compatible GitHub repo (flat .md files per skill).
 * awesome-claude — awesomeclaude.ai registry catalog.
 */
export type SourceType = 'local' | 'github' | 'npm' | 'skills-sh' | 'awesome-claude';
