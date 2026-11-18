import fs from 'node:fs';
import path from 'node:path';
import type { Branch } from '@/config/branches';

const cache = new Map<string, string>();

function read(relativePath: string): string {
  const cached = cache.get(relativePath);
  if (cached !== undefined) return cached;
  const text = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
  cache.set(relativePath, text);
  return text;
}

// Instructions + shared company knowledge + this branch's knowledge.
// Kept identical for every message of a branch so Claude's prompt cache can reuse it.
export function buildSystemPrompt(branch: Branch): string {
  const rules = read('prompts/system.md').replaceAll('{branch}', branch.name);
  const shared = read('knowledge/shared.md');
  const local = read(`knowledge/${branch.knowledgeFile}`);
  return [
    rules,
    '# Sunrose company knowledge',
    shared,
    `# ${branch.name} branch knowledge`,
    local,
  ].join('\n\n');
}
