import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { readLatestTeamProgressEvidenceMs } from '../progress-evidence.js';

async function withTemp<T>(fn: (cwd: string) => Promise<T>): Promise<T> {
  const cwd = await mkdtemp(join(tmpdir(), 'omc-progress-evidence-'));
  try {
    return await fn(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

describe('progress-evidence OMX parity adapter', () => {
  it('uses OMC nudge progress timestamps as team progress evidence', async () => {
    await withTemp(async (cwd) => {
      const stateDir = join(cwd, '.omc', 'state');
      await mkdir(stateDir, { recursive: true });
      await writeFile(join(stateDir, 'team-leader-nudge.json'), JSON.stringify({
        progress_by_team: {
          alpha: { last_progress_at: '2026-05-02T04:00:00.000Z' },
        },
      }));

      await expect(readLatestTeamProgressEvidenceMs(cwd, 'alpha'))
        .resolves.toBe(Date.parse('2026-05-02T04:00:00.000Z'));
    });
  });

  it('discovers worker paths from OMC team manifests and considers current task baselines', async () => {
    await withTemp(async (cwd) => {
      const worker = join(cwd, 'worker-1');
      const teamRoot = join(cwd, '.omc', 'state', 'team', 'alpha');
      const workerStateDir = join(worker, '.omc', 'state');
      await mkdir(teamRoot, { recursive: true });
      await mkdir(workerStateDir, { recursive: true });
      await writeFile(join(teamRoot, 'manifest.v2.json'), JSON.stringify({
        workers: [{ name: 'worker-1', worktree_path: worker }],
      }));
      const baselinePath = join(workerStateDir, 'current-task-baseline.json');
      await writeFile(baselinePath, JSON.stringify({ version: 1, tasks: [] }));
      const progressMs = Date.parse('2026-05-02T04:05:00.000Z');
      await utimes(baselinePath, new Date(progressMs), new Date(progressMs));

      await expect(readLatestTeamProgressEvidenceMs(cwd, 'alpha')).resolves.toBe(progressMs);
    });
  });

  it('returns NaN when no valid evidence exists', async () => {
    await withTemp(async (cwd) => {
      const value = await readLatestTeamProgressEvidenceMs(cwd, 'missing');
      expect(Number.isNaN(value)).toBe(true);
    });
  });
});
