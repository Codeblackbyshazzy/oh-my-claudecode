import { readdir, readFile } from 'fs/promises';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const DIRECT_PROCESS_PATTERNS = [
  /\bexecFileSync\(\s*['"]tmux['"]/,
  /\bexecFile\(\s*['"]tmux['"]/,
  /\bexecSync\(\s*['"]tmux\b/,
  /\bspawnSync\(\s*['"]tmux['"]/,
  /\bspawn\(\s*['"]tmux['"]/,
  /\bexecFileSync\(\s*['"](?:claude|codex|gemini)['"]/,
  /\bexecFile\(\s*['"](?:claude|codex|gemini)['"]/,
  /\bexecSync\(\s*['"](?:claude|codex|gemini)\b/,
  /\bspawnSync\(\s*['"](?:claude|codex|gemini)['"]/,
  /\bspawn\(\s*['"](?:claude|codex|gemini)['"]/,
];

function isVersionProbe(line: string): boolean {
  return /['\"]tmux\s+-V['\"]/.test(line) || /['\"]tmux['\"]/.test(line) && /['\"]-V['\"]/.test(line);
}

const ALLOWED_REAL_TMUX_FIXTURE_FILES = new Set([
  'src/team/__tests__/tmux-test-fixture.ts',
  'src/team/__tests__/tmux-test-fixture.test.ts',
]);

async function listTestFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return listTestFiles(fullPath);
    if (/\.(test|spec)\.ts$/.test(entry.name) || entry.name === 'tmux-test-fixture.ts') return [fullPath];
    return [];
  }));
  return files.flat();
}

describe('team test no-pane-leak guard', () => {
  it('keeps real tmux and worker CLI launches isolated to the gated tmux fixture', async () => {
    const root = join(process.cwd(), 'src', 'team', '__tests__');
    const files = await listTestFiles(root);
    const violations: string[] = [];

    for (const file of files) {
      const rel = relative(process.cwd(), file);
      if (ALLOWED_REAL_TMUX_FIXTURE_FILES.has(rel)) continue;

      const content = await readFile(file, 'utf-8');
      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (!isVersionProbe(line) && DIRECT_PROCESS_PATTERNS.some((pattern) => pattern.test(line))) {
          violations.push(`${rel}:${index + 1}: ${line.trim()}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
