import matter from 'gray-matter';
import fs from 'fs';

export interface FrontmatterData {
  name?:        string;
  description?: string;
  created?:     string;
  updated?:     string;
  version?:     string;
  tools?:       string;
  model?:       string;
  color?:       string;
  [key: string]: unknown;
}

/**
 * Parse YAML frontmatter from a SKILL.md or agent .md file.
 * Returns an empty object when the file does not exist or has no frontmatter.
 */
export function parseFrontmatter(filePath: string): FrontmatterData {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return matter(content).data as FrontmatterData;
  } catch {
    return {};
  }
}

/** Return the body of a markdown file with the frontmatter block stripped. */
export function stripFrontmatter(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return matter(content).content.trimStart();
  } catch {
    return '';
  }
}
