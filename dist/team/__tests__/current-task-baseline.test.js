import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { assertCurrentTaskBranchAvailable, findActiveCurrentTaskByBranch, readCurrentTaskBaseline, upsertCurrentTaskBaseline, } from '../current-task-baseline.js';
async function withTemp(fn) {
    const root = await mkdtemp(join(tmpdir(), 'omc-current-task-baseline-'));
    try {
        return await fn(root);
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
}
describe('current-task-baseline OMX parity adapter', () => {
    it('records branch baselines under the OMC state root', async () => {
        await withTemp(async (repo) => {
            const entry = upsertCurrentTaskBaseline(repo, {
                branch_name: 'feature/task-baseline',
                worktree_path: join(repo, '..', 'task-worktree'),
                status: 'active',
            });
            expect(entry.status).toBe('active');
            expect(findActiveCurrentTaskByBranch(repo, 'feature/task-baseline')?.worktree_path)
                .toBe(entry.worktree_path);
            expect(existsSync(join(repo, '.omc', 'state', 'current-task-baseline.json'))).toBe(true);
            expect(existsSync(join(repo, '.omx', 'state', 'current-task-baseline.json'))).toBe(false);
        });
    });
    it('accepts source-style OMX baseline files as read-only compatibility input', async () => {
        await withTemp(async (repo) => {
            const legacyPath = join(repo, '.omx', 'state', 'current-task-baseline.json');
            await mkdir(join(repo, '.omx', 'state'), { recursive: true });
            await writeFile(legacyPath, JSON.stringify({
                version: 1,
                tasks: [{
                        branch_name: 'feature/source-baseline',
                        worktree_path: join(repo, 'source-worktree'),
                        status: 'active',
                        created_at: '2026-05-02T00:00:00.000Z',
                        updated_at: '2026-05-02T00:00:00.000Z',
                    }],
            }), 'utf-8');
            expect(readCurrentTaskBaseline(repo).tasks).toHaveLength(1);
            expect(findActiveCurrentTaskByBranch(repo, 'feature/source-baseline')?.status).toBe('active');
        });
    });
    it('blocks duplicate branch creation when baseline points at another worktree path', async () => {
        await withTemp(async (repo) => {
            upsertCurrentTaskBaseline(repo, {
                branch_name: 'feature/already-active',
                worktree_path: join(repo, '..', 'some-other-worktree'),
                status: 'active',
            });
            expect(() => assertCurrentTaskBranchAvailable(repo, 'feature/already-active', join(repo, '..', 'new-worktree')))
                .toThrow(/current_task_branch_guard:feature\/already-active:/);
        });
    });
    it('updates branch lifecycle metadata when PR info is observed', async () => {
        await withTemp(async (repo) => {
            upsertCurrentTaskBaseline(repo, {
                branch_name: 'feature/pr-lifecycle',
                worktree_path: repo,
                status: 'active',
            });
            upsertCurrentTaskBaseline(repo, {
                branch_name: 'feature/pr-lifecycle',
                worktree_path: repo,
                issue_number: 1407,
                pr_number: 1416,
                pr_url: 'https://github.com/Yeachan-Heo/oh-my-codex/pull/1416',
                status: 'merged',
            });
            const raw = JSON.parse(await readFile(join(repo, '.omc', 'state', 'current-task-baseline.json'), 'utf-8'));
            const entry = raw.tasks.find((item) => item.branch_name === 'feature/pr-lifecycle');
            expect(entry?.issue_number).toBe(1407);
            expect(entry?.pr_number).toBe(1416);
            expect(entry?.status).toBe('merged');
        });
    });
});
//# sourceMappingURL=current-task-baseline.test.js.map