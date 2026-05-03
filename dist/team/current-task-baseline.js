import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { getOmcRoot } from '../lib/worktree-paths.js';
function baselinePath(repoRoot) {
    return join(getOmcRoot(repoRoot), 'state', 'current-task-baseline.json');
}
function legacyOmxBaselinePath(repoRoot) {
    return join(repoRoot, '.omx', 'state', 'current-task-baseline.json');
}
function emptyBaseline() {
    return { version: 1, tasks: [] };
}
function readBaselineFile(path) {
    try {
        const parsed = JSON.parse(readFileSync(path, 'utf-8'));
        if (parsed.version !== 1 || !Array.isArray(parsed.tasks))
            return emptyBaseline();
        return {
            version: 1,
            tasks: parsed.tasks
                .filter((entry) => entry && typeof entry.branch_name === 'string' && typeof entry.status === 'string')
                .map((entry) => ({
                ...entry,
                worktree_path: typeof entry.worktree_path === 'string' ? resolve(entry.worktree_path) : null,
            })),
        };
    }
    catch {
        return emptyBaseline();
    }
}
export function readCurrentTaskBaseline(repoRoot) {
    const path = baselinePath(repoRoot);
    if (existsSync(path))
        return readBaselineFile(path);
    const legacyPath = legacyOmxBaselinePath(repoRoot);
    if (existsSync(legacyPath))
        return readBaselineFile(legacyPath);
    return emptyBaseline();
}
function writeCurrentTaskBaseline(repoRoot, data) {
    const stateDir = join(getOmcRoot(repoRoot), 'state');
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(baselinePath(repoRoot), JSON.stringify(data, null, 2) + '\n', 'utf-8');
}
export function listActiveCurrentTasks(repoRoot) {
    return readCurrentTaskBaseline(repoRoot).tasks.filter((entry) => entry.status === 'active');
}
export function findActiveCurrentTaskByBranch(repoRoot, branchName) {
    const normalized = branchName.trim();
    if (!normalized)
        return null;
    return listActiveCurrentTasks(repoRoot).find((entry) => entry.branch_name === normalized) ?? null;
}
export function upsertCurrentTaskBaseline(repoRoot, input) {
    const branchName = input.branch_name.trim();
    if (!branchName) {
        throw new Error('current_task_baseline_branch_required');
    }
    const now = new Date().toISOString();
    const current = readCurrentTaskBaseline(repoRoot);
    const existing = current.tasks.find((entry) => entry.branch_name === branchName) ?? null;
    const next = {
        branch_name: branchName,
        worktree_path: typeof input.worktree_path === 'string'
            ? resolve(input.worktree_path)
            : input.worktree_path === null
                ? null
                : existing?.worktree_path ?? null,
        base_ref: input.base_ref ?? existing?.base_ref,
        issue_number: input.issue_number ?? existing?.issue_number,
        pr_number: input.pr_number ?? existing?.pr_number,
        pr_url: input.pr_url ?? existing?.pr_url,
        status: input.status ?? existing?.status ?? 'active',
        created_at: existing?.created_at ?? now,
        updated_at: now,
    };
    const tasks = current.tasks.filter((entry) => entry.branch_name !== branchName);
    tasks.push(next);
    tasks.sort((a, b) => a.branch_name.localeCompare(b.branch_name));
    writeCurrentTaskBaseline(repoRoot, { version: 1, tasks });
    return next;
}
export function assertCurrentTaskBranchAvailable(repoRoot, branchName, requestedWorktreePath) {
    const current = findActiveCurrentTaskByBranch(repoRoot, branchName);
    if (!current)
        return;
    const requested = resolve(requestedWorktreePath);
    if (!current.worktree_path || current.worktree_path !== requested) {
        throw new Error(`current_task_branch_guard:${branchName}:${current.worktree_path ?? 'unknown_worktree'}`);
    }
}
//# sourceMappingURL=current-task-baseline.js.map