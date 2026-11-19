import fs from 'node:fs';
import path from 'node:path';
import type { Branch } from '@/config/branches';

const cache = new Map<string, string>();

// Each folder is written out in full so the build only bundles these two folders.
function readKnowledge(file: string): string {
  return cached(`knowledge/${file}`, () =>
    fs.readFileSync(path.join(process.cwd(), 'knowledge', file), 'utf8'),
  );
}

function readPrompt(file: string): string {
  return cached(`prompts/${file}`, () =>
    fs.readFileSync(path.join(process.cwd(), 'prompts', file), 'utf8'),
  );
}

function cached(key: string, load: () => string): string {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const text = load();
  cache.set(key, text);
  return text;
}

// Instructions + shared company knowledge + hardware + this branch's knowledge.
// Kept identical for every message of a branch so Claude's prompt cache can reuse it.
export function buildSystemPrompt(branch: Branch): string {
  const rules = readPrompt('system.md').replaceAll('{branch}', branch.name);
  return [
    rules,
    '# Sunrose company knowledge (commercial equipment)',
    readKnowledge('shared.md'),
    '# Hardware, building and decor products',
    readKnowledge('hardware.md'),
    `# ${branch.name} branch knowledge`,
    readKnowledge(branch.knowledgeFile),
  ].join('\n\n');
}
