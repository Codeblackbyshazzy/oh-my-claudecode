import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'fs/promises';
import { execFileSync } from 'child_process';
import { join, relative } from 'path';
import { tmpdir } from 'os';
import { isLeaderRuntimeStale, readLatestLeaderActivityMsFromStateDir, recordLeaderRuntimeActivity, } from '../leader-activity.js';
async function withTemp(prefix, fn) {
    const cwd = await mkdtemp(join(tmpdir(), prefix));
    try {
        return await fn(cwd);
    }
    finally {
        await rm(cwd, { recursive: true, force: true });
    }
}
async function withWindowsPlatform(run) {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    try {
        await run();
    }
    finally {
        if (originalPlatform) {
            Object.defineProperty(process, 'platform', originalPlatform);
        }
    }
}
async function createWorktreePointerFixture(cwd) {
    const gitDir = join(cwd, '.git-admin', 'worktrees', 'feature');
    const commonDir = join(cwd, '.git-admin');
    await mkdir(join(gitDir, 'logs'), { recursive: true });
    await mkdir(join(commonDir, 'logs', 'refs', 'heads'), { recursive: true });
    await mkdir(commonDir, { recursive: true });
    await writeFile(join(cwd, '.git'), `gitdir: ${relative(cwd, gitDir)}\n`);
    await writeFile(join(gitDir, 'HEAD'), 'ref: refs/heads/worktree-branch\n');
    await writeFile(join(gitDir, 'commondir'), '../..\n');
    await writeFile(join(gitDir, 'logs', 'HEAD'), 'old\n');
    await writeFile(join(commonDir, 'logs', 'refs', 'heads', 'worktree-branch'), 'new\n');
    await writeFile(join(commonDir, 'config'), '');
    return { gitDir, commonDir };
}
describe('leader runtime activity OMX parity adapter', () => {
    it('records team status activity under the OMC state root', async () => {
        await withTemp('omc-leader-activity-', async (cwd) => {
            const nowIso = '2026-03-21T04:11:12.000Z';
            await recordLeaderRuntimeActivity(cwd, 'team_status', 'alpha', nowIso);
            const activity = JSON.parse(await readFile(join(cwd, '.omc', 'state', 'leader-runtime-activity.json'), 'utf-8'));
            expect(activity.last_activity_at).toBe(nowIso);
            expect(activity.last_team_status_at).toBe(nowIso);
            expect(activity.last_source).toBe('team_status');
            expect(activity.last_team_name).toBe('alpha');
        });
    });
    it('uses the newest runtime signal across hud and explicit leader activity', async () => {
        await withTemp('omc-leader-activity-', async (cwd) => {
            const stateDir = join(cwd, '.omc', 'state');
            await mkdir(stateDir, { recursive: true });
            await writeFile(join(stateDir, 'hud-state.json'), JSON.stringify({
                last_turn_at: '2026-03-21T04:00:00.000Z',
            }));
            await writeFile(join(stateDir, 'leader-runtime-activity.json'), JSON.stringify({
                last_activity_at: '2026-03-21T04:05:00.000Z',
                last_source: 'team_status',
            }));
            await expect(readLatestLeaderActivityMsFromStateDir(stateDir))
                .resolves.toBe(Date.parse('2026-03-21T04:05:00.000Z'));
        });
    });
    it('treats the leader as active when any runtime signal is still fresh', async () => {
        await withTemp('omc-leader-activity-', async (cwd) => {
            const stateDir = join(cwd, '.omc', 'state');
            await mkdir(stateDir, { recursive: true });
            const nowMs = Date.parse('2026-03-21T04:10:00.000Z');
            await writeFile(join(stateDir, 'hud-state.json'), JSON.stringify({
                last_turn_at: '2026-03-21T04:00:00.000Z',
            }));
            await writeFile(join(stateDir, 'leader-runtime-activity.json'), JSON.stringify({
                last_activity_at: '2026-03-21T04:09:50.000Z',
                last_source: 'team_status',
            }));
            await expect(isLeaderRuntimeStale(stateDir, 30_000, nowMs)).resolves.toBe(false);
        });
    });
    it('treats the leader as stale only when every valid runtime signal is stale', async () => {
        await withTemp('omc-leader-activity-', async (cwd) => {
            const stateDir = join(cwd, '.omc', 'state');
            await mkdir(stateDir, { recursive: true });
            const nowMs = Date.parse('2026-03-21T04:10:00.000Z');
            await writeFile(join(stateDir, 'hud-state.json'), JSON.stringify({
                last_turn_at: '2026-03-21T04:00:00.000Z',
            }));
            await writeFile(join(stateDir, 'leader-runtime-activity.json'), JSON.stringify({
                last_activity_at: '2026-03-21T04:05:00.000Z',
                last_source: 'team_status',
            }));
            await expect(isLeaderRuntimeStale(stateDir, 30_000, nowMs)).resolves.toBe(true);
        });
    });
    it('treats recent leader-branch git movement as activity even when runtime timestamps are stale', async () => {
        await withTemp('omc-leader-activity-git-', async (cwd) => {
            execFileSync('git', ['init'], { cwd, stdio: 'ignore' });
            execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd, stdio: 'ignore' });
            execFileSync('git', ['config', 'user.name', 'Test User'], { cwd, stdio: 'ignore' });
            await writeFile(join(cwd, 'README.md'), 'hello\n', 'utf-8');
            execFileSync('git', ['add', 'README.md'], { cwd, stdio: 'ignore' });
            execFileSync('git', ['commit', '-m', 'init'], { cwd, stdio: 'ignore' });
            const stateDir = join(cwd, '.omc', 'state');
            await mkdir(stateDir, { recursive: true });
            await writeFile(join(stateDir, 'hud-state.json'), JSON.stringify({ last_turn_at: '2026-03-21T04:00:00.000Z' }));
            await writeFile(join(stateDir, 'leader-runtime-activity.json'), JSON.stringify({
                last_activity_at: '2026-03-21T04:00:00.000Z',
                last_source: 'team_status',
            }));
            await writeFile(join(cwd, 'README.md'), 'hello world\n', 'utf-8');
            execFileSync('git', ['add', 'README.md'], { cwd, stdio: 'ignore' });
            execFileSync('git', ['commit', '-m', 'leader progress'], { cwd, stdio: 'ignore' });
            const headMs = Number(execFileSync('git', ['show', '-s', '--format=%ct', 'HEAD'], {
                cwd,
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'ignore'],
            }).trim()) * 1000;
            await expect(isLeaderRuntimeStale(stateDir, 30_000, headMs + 5_000)).resolves.toBe(false);
        });
    });
    it('treats worktree .git file pointers as recent branch activity on Windows', async () => {
        await withTemp('omc-leader-activity-worktree-', async (cwd) => {
            const { gitDir, commonDir } = await createWorktreePointerFixture(cwd);
            const stateDir = join(cwd, '.omc', 'state');
            await mkdir(stateDir, { recursive: true });
            await writeFile(join(stateDir, 'hud-state.json'), JSON.stringify({ last_turn_at: '2026-03-21T04:00:00.000Z' }));
            await writeFile(join(stateDir, 'leader-runtime-activity.json'), JSON.stringify({
                last_activity_at: '2026-03-21T04:00:00.000Z',
                last_source: 'team_status',
            }));
            const staleMs = Date.parse('2026-03-21T04:00:00.000Z');
            const recentMs = Date.parse('2026-03-21T04:10:00.000Z');
            await utimes(join(gitDir, 'HEAD'), new Date(staleMs), new Date(staleMs));
            await utimes(join(gitDir, 'logs', 'HEAD'), new Date(staleMs), new Date(staleMs));
            await utimes(join(commonDir, 'logs', 'refs', 'heads', 'worktree-branch'), new Date(recentMs), new Date(recentMs));
            await withWindowsPlatform(async () => {
                await expect(isLeaderRuntimeStale(stateDir, 30_000, recentMs + 5_000)).resolves.toBe(false);
            });
        });
    });
    it('treats missing or invalid runtime evidence as not stale', async () => {
        await withTemp('omc-leader-activity-', async (cwd) => {
            const stateDir = join(cwd, '.omc', 'state');
            await mkdir(stateDir, { recursive: true });
            await expect(isLeaderRuntimeStale(stateDir, 30_000, Date.now())).resolves.toBe(false);
            await writeFile(join(stateDir, 'hud-state.json'), JSON.stringify({ last_turn_at: 'not-a-date' }));
            await writeFile(join(stateDir, 'leader-runtime-activity.json'), JSON.stringify({ last_activity_at: '' }));
            await expect(isLeaderRuntimeStale(stateDir, 30_000, Date.now())).resolves.toBe(false);
        });
    });
});
//# sourceMappingURL=leader-activity.test.js.map