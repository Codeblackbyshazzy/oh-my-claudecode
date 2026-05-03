import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, posix, resolve, sep, win32 } from 'node:path';
import { getOmcRoot } from '../lib/worktree-paths.js';
import { findGitLayout, readGitLayoutFile } from '../utils/git-layout.js';
const MIN_GIT_ACTIVITY_CACHE_TTL_MS = 1000;
const MAX_GIT_ACTIVITY_CACHE_TTL_MS = 5000;
const gitActivityCache = new Map();
async function readJsonIfExists(path) {
    try {
        return JSON.parse(await readFile(path, 'utf-8'));
    }
    catch {
        return null;
    }
}
function parseIsoMs(value) {
    if (typeof value !== 'string' || value.trim().length === 0)
        return Number.NaN;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
}
function parseEpochSecondsMs(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return Number.NaN;
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? seconds * 1000 : Number.NaN;
}
function resolveGitOutputPath(cwd, gitPath) {
    if (!gitPath)
        return null;
    if (posix.isAbsolute(gitPath) || win32.isAbsolute(gitPath))
        return gitPath;
    return resolve(cwd, gitPath);
}
/**
 * On Windows, read git info from .git/ files directly to avoid spawning
 * console windows (conhost.exe flicker on every poll cycle).
 *
 * See: https://github.com/Yeachan-Heo/oh-my-codex/issues/1100
 */
async function tryReadGitValue(cwd, args) {
    if (process.platform === 'win32') {
        try {
            const gitLayout = findGitLayout(cwd);
            if (gitLayout) {
                const cmd = args.join(' ');
                if (cmd === 'rev-parse --git-dir')
                    return gitLayout.gitDir;
                if (cmd === 'symbolic-ref --quiet --short HEAD') {
                    const head = readGitLayoutFile(gitLayout.gitDir, 'HEAD');
                    if (head?.startsWith('ref: refs/heads/'))
                        return head.slice('ref: refs/heads/'.length);
                    return null; // detached HEAD
                }
                if (cmd === 'rev-parse --git-path logs/HEAD') {
                    return join(gitLayout.gitDir, 'logs', 'HEAD');
                }
                if (cmd.startsWith('rev-parse --git-path logs/refs/heads/')) {
                    const branch = args[args.length - 1].replace('logs/', '');
                    const candidate = resolve(join(gitLayout.commonDir, 'logs', branch));
                    const resolvedBase = resolve(gitLayout.commonDir);
                    if (candidate !== resolvedBase && !candidate.startsWith(resolvedBase + sep))
                        return null;
                    return candidate;
                }
                if (cmd === 'show -s --format=%ct HEAD') {
                    // Use HEAD file mtime as a proxy for last-commit timestamp.
                    try {
                        const headMs = statSync(join(gitLayout.gitDir, 'HEAD')).mtimeMs;
                        return String(Math.floor(headMs / 1000));
                    }
                    catch {
                        return null;
                    }
                }
            }
        }
        catch { /* fall through */ }
    }
    return await tryReadGitValueExec(cwd, args);
}
async function tryReadGitValueExec(cwd, args) {
    try {
        const { stdout } = await execFileAsync('git', args, {
            cwd,
            encoding: 'utf-8',
            timeout: 2000,
            windowsHide: true,
        });
        return stdout.trim() || null;
    }
    catch {
        return null;
    }
}
async function statMsIfExists(path) {
    if (!path || !existsSync(path))
        return Number.NaN;
    try {
        return (await stat(path)).mtimeMs;
    }
    catch {
        return Number.NaN;
    }
}
function stateDirToProjectRoot(stateDir) {
    let current = resolve(stateDir);
    while (current !== dirname(current)) {
        if (basename(current) === '.omc' || basename(current) === '.omx')
            return dirname(current);
        current = dirname(current);
    }
    return dirname(dirname(stateDir));
}
export async function readBranchGitActivityMsForPath(cwd) {
    const gitDir = await tryReadGitValue(cwd, ['rev-parse', '--git-dir']);
    if (!gitDir)
        return Number.NaN;
    const branch = await tryReadGitValue(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
    const headLogPath = await tryReadGitValue(cwd, ['rev-parse', '--git-path', 'logs/HEAD']);
    const branchLogPath = branch
        ? await tryReadGitValue(cwd, ['rev-parse', '--git-path', `logs/refs/heads/${branch}`])
        : null;
    const headCommitEpoch = await tryReadGitValue(cwd, ['show', '-s', '--format=%ct', 'HEAD']);
    const [headLogMs, branchLogMs] = await Promise.all([
        statMsIfExists(resolveGitOutputPath(cwd, headLogPath)),
        statMsIfExists(resolveGitOutputPath(cwd, branchLogPath)),
    ]);
    const headCommitMs = headCommitEpoch ? parseEpochSecondsMs(headCommitEpoch) : Number.NaN;
    const candidates = [headLogMs, branchLogMs, headCommitMs].filter((ms) => Number.isFinite(ms));
    return candidates.length > 0 ? Math.max(...candidates) : Number.NaN;
}
async function readLeaderBranchGitActivityMs(stateDir) {
    return await readBranchGitActivityMsForPath(stateDirToProjectRoot(stateDir));
}
function resolveLeaderGitActivityCacheTtlMs(thresholdMs) {
    if (!Number.isFinite(thresholdMs) || thresholdMs <= 0) {
        return MAX_GIT_ACTIVITY_CACHE_TTL_MS;
    }
    return Math.max(MIN_GIT_ACTIVITY_CACHE_TTL_MS, Math.min(MAX_GIT_ACTIVITY_CACHE_TTL_MS, Math.floor(thresholdMs / 4)));
}
async function readLeaderBranchGitActivityMsCached(stateDir, thresholdMs, nowMs) {
    const cacheKey = stateDirToProjectRoot(stateDir);
    const cached = gitActivityCache.get(cacheKey);
    if (cached && cached.expiresAt > nowMs) {
        return cached.value;
    }
    const value = await readLeaderBranchGitActivityMs(stateDir);
    gitActivityCache.set(cacheKey, {
        value,
        expiresAt: nowMs + resolveLeaderGitActivityCacheTtlMs(thresholdMs),
    });
    return value;
}
export function leaderRuntimeActivityPath(cwd) {
    return join(getOmcRoot(cwd), 'state', 'leader-runtime-activity.json');
}
export async function recordLeaderRuntimeActivity(cwd, source, teamName, nowIso = new Date().toISOString()) {
    const stateDir = join(getOmcRoot(cwd), 'state');
    await mkdir(stateDir, { recursive: true });
    const path = leaderRuntimeActivityPath(cwd);
    const existingRaw = await readJsonIfExists(path);
    const existing = existingRaw && typeof existingRaw === 'object'
        ? existingRaw
        : {};
    const next = {
        ...existing,
        last_activity_at: nowIso,
        last_source: source,
    };
    if (source === 'team_status')
        next.last_team_status_at = nowIso;
    if (teamName)
        next.last_team_name = teamName;
    await writeFile(path, JSON.stringify(next, null, 2));
}
export async function readLeaderRuntimeSignalStatuses(stateDir, thresholdMs, nowMs) {
    const hudPath = join(stateDir, 'hud-state.json');
    const leaderActivityPath = join(stateDir, 'leader-runtime-activity.json');
    const [hudState, leaderActivity, leaderGitActivityMs] = await Promise.all([
        existsSync(hudPath) ? readJsonIfExists(hudPath) : Promise.resolve(null),
        existsSync(leaderActivityPath) ? readJsonIfExists(leaderActivityPath) : Promise.resolve(null),
        readLeaderBranchGitActivityMsCached(stateDir, thresholdMs, nowMs),
    ]);
    const signals = [
        { source: 'hud', at: hudState?.last_turn_at },
        { source: 'leader_runtime_activity', at: leaderActivity?.last_activity_at },
        {
            source: 'leader_branch_git_activity',
            at: Number.isFinite(leaderGitActivityMs) ? new Date(leaderGitActivityMs).toISOString() : null,
            ms: leaderGitActivityMs,
        },
    ];
    return signals.map(({ source, at, ms: providedMs }) => {
        const ms = Number.isFinite(providedMs) ? Number(providedMs) : parseIsoMs(at);
        const valid = Number.isFinite(ms);
        const fresh = valid && (nowMs - ms) < thresholdMs;
        return {
            source,
            at: typeof at === 'string' && at.trim().length > 0 ? at : null,
            ms,
            valid,
            fresh,
        };
    });
}
export async function readLatestLeaderActivityMsFromStateDir(stateDir) {
    const statuses = await readLeaderRuntimeSignalStatuses(stateDir, Number.MAX_SAFE_INTEGER, Date.now());
    const validMs = statuses.filter((status) => status.valid).map((status) => status.ms);
    return validMs.length > 0 ? Math.max(...validMs) : Number.NaN;
}
export async function isLeaderRuntimeStale(stateDir, thresholdMs, nowMs) {
    const statuses = await readLeaderRuntimeSignalStatuses(stateDir, thresholdMs, nowMs);
    const validStatuses = statuses.filter((status) => status.valid);
    if (validStatuses.length === 0)
        return false;
    return validStatuses.every((status) => !status.fresh);
}
//# sourceMappingURL=leader-activity.js.map