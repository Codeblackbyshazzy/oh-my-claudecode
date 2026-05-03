import { mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { TeamPaths, absPath } from './state-paths.js';
import { DEFAULT_TEAM_GOVERNANCE, normalizeTeamGovernance } from './governance.js';
import { teamAppendEvent, teamBroadcast, teamClaimTask, teamCleanup, teamCreateTask, teamGetSummary, teamListMailbox, teamListTasks, teamMarkMessageDelivered, teamMarkMessageNotified, teamReadConfig, teamReadManifest, teamReadMonitorSnapshot, teamReadShutdownAck, teamReadTask, teamReadTaskApproval, teamReadWorkerHeartbeat, teamReadWorkerStatus, teamReleaseTaskClaim, teamSendMessage, teamTransitionTaskStatus, teamUpdateTask, teamUpdateWorkerHeartbeat, teamWriteMonitorSnapshot, teamWriteShutdownRequest, teamWriteTaskApproval, teamWriteWorkerIdentity, teamWriteWorkerInbox, writeAtomic, } from './team-ops.js';
export const DEFAULT_MAX_WORKERS = 20;
export const ABSOLUTE_MAX_WORKERS = 20;
export function setWriteAtomicRenameForTests() {
    // Compatibility no-op: target writeAtomic is owned by team-ops.
}
export function resetWriteAtomicRenameForTests() {
    // Compatibility no-op: target writeAtomic is owned by team-ops.
}
export function normalizeTeamPolicy(policy) {
    return {
        display_mode: policy?.display_mode ?? 'split_pane',
        worker_launch_mode: policy?.worker_launch_mode ?? 'prompt',
        dispatch_mode: policy?.dispatch_mode ?? 'hook_preferred_with_fallback',
        dispatch_ack_timeout_ms: policy?.dispatch_ack_timeout_ms ?? 15_000,
        ...normalizeTeamGovernance(undefined, policy),
    };
}
export { normalizeTeamGovernance };
export function teamEventLogPath(teamName, cwd) {
    return absPath(cwd, TeamPaths.events(teamName));
}
export { writeAtomic };
export async function initTeamState(config, cwd) {
    await saveTeamConfig(config, cwd);
    await mkdir(absPath(cwd, TeamPaths.tasks(config.name)), { recursive: true });
    await mkdir(absPath(cwd, TeamPaths.workers(config.name)), { recursive: true });
    await mkdir(absPath(cwd, join(TeamPaths.root(config.name), 'claims')), { recursive: true });
    await mkdir(absPath(cwd, join(TeamPaths.root(config.name), 'mailbox')), { recursive: true });
    await mkdir(absPath(cwd, join(TeamPaths.root(config.name), 'events')), { recursive: true });
    await Promise.all(config.workers.map((worker) => mkdir(absPath(cwd, TeamPaths.workerDir(config.name, worker.name)), { recursive: true })));
}
export async function writeTeamManifestV2(manifest, cwd) {
    await writeAtomic(absPath(cwd, TeamPaths.manifest(manifest.name)), JSON.stringify(manifest, null, 2));
}
export async function readTeamManifestV2(teamName, cwd) {
    return teamReadManifest(teamName, cwd);
}
export async function migrateV1ToV2(teamName, cwd) {
    return teamReadManifest(teamName, cwd);
}
export async function readTeamConfig(teamName, cwd) {
    return teamReadConfig(teamName, cwd);
}
export async function saveTeamConfig(config, cwd) {
    await writeAtomic(absPath(cwd, TeamPaths.config(config.name)), JSON.stringify(config, null, 2));
}
export async function writeWorkerIdentity(teamName, workerName, identity, cwd) {
    return teamWriteWorkerIdentity(teamName, workerName, identity, cwd);
}
export async function readWorkerHeartbeat(teamName, workerName, cwd) {
    return teamReadWorkerHeartbeat(teamName, workerName, cwd);
}
export async function updateWorkerHeartbeat(teamName, workerName, heartbeat, cwd) {
    return teamUpdateWorkerHeartbeat(teamName, workerName, heartbeat, cwd);
}
export async function readWorkerStatus(teamName, workerName, cwd) {
    return teamReadWorkerStatus(teamName, workerName, cwd);
}
export async function writeWorkerStatus(teamName, workerName, status, cwd) {
    await writeAtomic(absPath(cwd, TeamPaths.workerStatus(teamName, workerName)), JSON.stringify(status, null, 2));
}
export async function writeWorkerInbox(teamName, workerName, prompt, cwd) {
    return teamWriteWorkerInbox(teamName, workerName, prompt, cwd);
}
export async function createTask(teamName, task, cwd) {
    return teamCreateTask(teamName, task, cwd);
}
export async function readTask(teamName, taskId, cwd) {
    return teamReadTask(teamName, taskId, cwd);
}
export async function updateTask(teamName, taskId, patch, cwd) {
    const updated = await teamUpdateTask(teamName, taskId, patch, cwd);
    if (!updated)
        throw new Error(`task_not_found:${taskId}`);
    return updated;
}
export async function listTasks(teamName, cwd) {
    return teamListTasks(teamName, cwd);
}
export async function computeTaskReadiness(teamName, taskId, cwd) {
    const task = await readTask(teamName, taskId, cwd);
    if (!task)
        return { ready: false, reason: 'blocked_dependency', dependencies: [] };
    const deps = task.depends_on ?? task.blocked_by ?? [];
    if (deps.length === 0)
        return { ready: true };
    const depTasks = await Promise.all(deps.map((dep) => readTask(teamName, dep, cwd)));
    const incomplete = deps.filter((_, index) => depTasks[index]?.status !== 'completed');
    return incomplete.length > 0 ? { ready: false, reason: 'blocked_dependency', dependencies: incomplete } : { ready: true };
}
export async function claimTask(teamName, taskId, workerName, expectedVersion, cwd) {
    return teamClaimTask(teamName, taskId, workerName, expectedVersion, cwd);
}
export async function transitionTaskStatus(teamName, taskId, from, to, claimToken, terminalData, cwd) {
    return teamTransitionTaskStatus(teamName, taskId, from, to, claimToken, cwd, terminalData);
}
export async function releaseTaskClaim(teamName, taskId, workerName, claimToken, cwd) {
    return teamReleaseTaskClaim(teamName, taskId, claimToken, workerName, cwd);
}
export async function reclaimExpiredTaskClaim() {
    return { ok: false, error: 'not_supported' };
}
export async function appendTeamEvent(teamName, event, cwd) {
    return teamAppendEvent(teamName, event, cwd);
}
export function resolveDispatchLockTimeoutMs(env = process.env) {
    const raw = env.OMC_TEAM_DISPATCH_LOCK_TIMEOUT_MS ?? env.OMX_TEAM_DISPATCH_LOCK_TIMEOUT_MS;
    const parsed = raw ? Number(raw) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5_000;
}
export async function enqueueDispatchRequest(teamName, input, cwd) {
    const request = {
        request_id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        kind: input.kind,
        team_name: teamName,
        to_worker: input.to_worker,
        worker_index: input.worker_index,
        pane_id: input.pane_id,
        trigger_message: input.trigger_message,
        message_id: input.message_id,
        inbox_correlation_key: input.inbox_correlation_key,
        transport_preference: input.transport_preference ?? 'hook_preferred_with_fallback',
        fallback_allowed: input.fallback_allowed ?? true,
        status: 'pending',
        attempt_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_reason: input.last_reason,
    };
    const path = absPath(cwd, join(TeamPaths.root(teamName), 'dispatch', `${request.request_id}.json`));
    await writeAtomic(path, JSON.stringify(request, null, 2));
    return request;
}
async function readJson(path) {
    try {
        if (!existsSync(path))
            return null;
        return JSON.parse(await readFile(path, 'utf-8'));
    }
    catch {
        return null;
    }
}
export async function listDispatchRequests(teamName, cwd) {
    const dir = absPath(cwd, join(TeamPaths.root(teamName), 'dispatch'));
    try {
        const { readdir } = await import('fs/promises');
        const files = (await readdir(dir)).filter((file) => file.endsWith('.json'));
        const requests = await Promise.all(files.map((file) => readJson(join(dir, file))));
        return requests.filter((request) => Boolean(request));
    }
    catch {
        return [];
    }
}
export async function readDispatchRequest(teamName, requestId, cwd) {
    return readJson(absPath(cwd, join(TeamPaths.root(teamName), 'dispatch', `${requestId}.json`)));
}
export async function transitionDispatchRequest(teamName, requestId, status, patch, cwd) {
    const current = await readDispatchRequest(teamName, requestId, cwd);
    if (!current)
        return null;
    const updated = { ...current, ...patch, status, updated_at: new Date().toISOString() };
    await writeAtomic(absPath(cwd, join(TeamPaths.root(teamName), 'dispatch', `${requestId}.json`)), JSON.stringify(updated, null, 2));
    return updated;
}
export async function markDispatchRequestNotified(teamName, requestId, cwd) {
    return transitionDispatchRequest(teamName, requestId, 'notified', { notified_at: new Date().toISOString() }, cwd);
}
export async function markDispatchRequestDelivered(teamName, requestId, cwd) {
    return transitionDispatchRequest(teamName, requestId, 'delivered', { delivered_at: new Date().toISOString() }, cwd);
}
export async function sendDirectMessage(teamName, fromWorker, toWorker, body, cwd) {
    return teamSendMessage(teamName, fromWorker, toWorker, body, cwd);
}
export async function broadcastMessage(teamName, fromWorker, body, cwd) {
    return teamBroadcast(teamName, fromWorker, body, cwd);
}
export async function markMessageDelivered(teamName, workerName, messageId, cwd) {
    return teamMarkMessageDelivered(teamName, workerName, messageId, cwd);
}
export async function markMessageNotified(teamName, workerName, messageId, cwd) {
    return teamMarkMessageNotified(teamName, workerName, messageId, cwd);
}
export async function listMailboxMessages(teamName, workerName, cwd) {
    return teamListMailbox(teamName, workerName, cwd);
}
export async function writeTaskApproval(approval, deps) {
    return teamWriteTaskApproval(deps.teamName, approval, deps.cwd);
}
export async function readTaskApproval(taskId, deps) {
    return teamReadTaskApproval(deps.teamName, taskId, deps.cwd);
}
export async function getTeamSummary(teamName, cwd) {
    return teamGetSummary(teamName, cwd);
}
export async function writeShutdownRequest(teamName, reason, cwd) {
    return teamWriteShutdownRequest(teamName, 'all', reason, cwd);
}
export async function readShutdownAck(teamName, workerName, cwd) {
    return teamReadShutdownAck(teamName, workerName, cwd);
}
export async function readMonitorSnapshot(teamName, cwd) {
    return teamReadMonitorSnapshot(teamName, cwd);
}
export async function writeMonitorSnapshot(teamName, snapshot, cwd) {
    return teamWriteMonitorSnapshot(teamName, snapshot, cwd);
}
export async function readTeamPhase(teamName, cwd) {
    return readJson(absPath(cwd, join(TeamPaths.root(teamName), 'phase.json')));
}
export async function writeTeamPhase(teamName, phase, cwd) {
    await writeAtomic(absPath(cwd, join(TeamPaths.root(teamName), 'phase.json')), JSON.stringify(phase, null, 2));
}
export async function readTeamLeaderAttention() { return null; }
export async function writeTeamLeaderAttention() { }
export async function markTeamLeaderSessionStopped() { }
export async function markTeamLeaderStopObserved() { }
export async function markOwnedTeamsLeaderSessionStopped() { }
export async function markOwnedTeamsLeaderStopObserved() { }
export async function cleanupTeamState(teamName, cwd) {
    return teamCleanup(teamName, cwd);
}
export { DEFAULT_TEAM_GOVERNANCE };
//# sourceMappingURL=state.js.map