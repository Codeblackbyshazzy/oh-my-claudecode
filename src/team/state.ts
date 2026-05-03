import { mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { TeamPaths, absPath } from './state-paths.js';
import { DEFAULT_TEAM_GOVERNANCE, normalizeTeamGovernance } from './governance.js';
import type { TeamTaskStatus } from './contracts.js';
import {
  teamAppendEvent,
  teamBroadcast,
  teamClaimTask,
  teamCleanup,
  teamCreateTask,
  teamGetSummary,
  teamListMailbox,
  teamListTasks,
  teamMarkMessageDelivered,
  teamMarkMessageNotified,
  teamReadConfig,
  teamReadManifest,
  teamReadMonitorSnapshot,
  teamReadShutdownAck,
  teamReadTask,
  teamReadTaskApproval,
  teamReadWorkerHeartbeat,
  teamReadWorkerStatus,
  teamReleaseTaskClaim,
  teamSendMessage,
  teamTransitionTaskStatus,
  teamUpdateTask,
  teamUpdateWorkerHeartbeat,
  teamWriteMonitorSnapshot,
  teamWriteShutdownRequest,
  teamWriteTaskApproval,
  teamWriteWorkerIdentity,
  teamWriteWorkerInbox,
  writeAtomic,
} from './team-ops.js';
import type {
  ClaimTaskResult,
  ReleaseTaskClaimResult,
  ShutdownAck,
  TaskApprovalRecord,
  TaskReadiness,
  TeamConfig,
  TeamDispatchRequest,
  TeamDispatchRequestInput,
  TeamDispatchRequestStatus,
  TeamEvent,
  TeamMailboxMessage,
  TeamManifestV2,
  TeamMonitorSnapshotState,
  TeamPhaseState,
  TeamPolicy,
  TeamSummary,
  TeamTask,
  TeamTaskV2,
  TransitionTaskResult,
  WorkerHeartbeat,
  WorkerInfo,
  WorkerStatus,
} from './types.js';

export type { TeamEventType, TeamTaskStatus } from './contracts.js';
export type {
  ClaimTaskResult,
  ReleaseTaskClaimResult,
  ShutdownAck,
  TaskApprovalRecord,
  TaskReadiness,
  TeamConfig,
  TeamDispatchRequest,
  TeamDispatchRequestInput,
  TeamDispatchRequestStatus,
  TeamEvent,
  TeamMailboxMessage,
  TeamManifestV2,
  TeamMonitorSnapshotState,
  TeamPhaseState,
  TeamPolicy,
  TeamSummary,
  TeamTask,
  TeamTaskChildModelPolicy,
  TeamTaskDelegationMode,
  TeamTaskV2,
  TransitionTaskResult,
  WorkerHeartbeat,
  WorkerInfo,
  WorkerStatus,
} from './types.js';

export const DEFAULT_MAX_WORKERS = 20;
export const ABSOLUTE_MAX_WORKERS = 20;

export function setWriteAtomicRenameForTests(): void {
  // Compatibility no-op: target writeAtomic is owned by team-ops.
}

export function resetWriteAtomicRenameForTests(): void {
  // Compatibility no-op: target writeAtomic is owned by team-ops.
}

export function normalizeTeamPolicy(policy?: Partial<TeamPolicy> | null): TeamPolicy {
  return {
    display_mode: policy?.display_mode ?? 'split_pane',
    worker_launch_mode: policy?.worker_launch_mode ?? 'prompt',
    dispatch_mode: policy?.dispatch_mode ?? 'hook_preferred_with_fallback',
    dispatch_ack_timeout_ms: policy?.dispatch_ack_timeout_ms ?? 15_000,
    ...normalizeTeamGovernance(undefined, policy),
  };
}

export { normalizeTeamGovernance };

export function teamEventLogPath(teamName: string, cwd: string): string {
  return absPath(cwd, TeamPaths.events(teamName));
}

export { writeAtomic };

export async function initTeamState(config: TeamConfig, cwd: string): Promise<void> {
  await saveTeamConfig(config, cwd);
  await mkdir(absPath(cwd, TeamPaths.tasks(config.name)), { recursive: true });
  await mkdir(absPath(cwd, TeamPaths.workers(config.name)), { recursive: true });
  await mkdir(absPath(cwd, join(TeamPaths.root(config.name), 'claims')), { recursive: true });
  await mkdir(absPath(cwd, join(TeamPaths.root(config.name), 'mailbox')), { recursive: true });
  await mkdir(absPath(cwd, join(TeamPaths.root(config.name), 'events')), { recursive: true });
  await Promise.all(config.workers.map((worker) =>
    mkdir(absPath(cwd, TeamPaths.workerDir(config.name, worker.name)), { recursive: true })));
}

export async function writeTeamManifestV2(manifest: TeamManifestV2, cwd: string): Promise<void> {
  await writeAtomic(absPath(cwd, TeamPaths.manifest(manifest.name)), JSON.stringify(manifest, null, 2));
}

export async function readTeamManifestV2(teamName: string, cwd: string): Promise<TeamManifestV2 | null> {
  return teamReadManifest(teamName, cwd);
}

export async function migrateV1ToV2(teamName: string, cwd: string): Promise<TeamManifestV2 | null> {
  return teamReadManifest(teamName, cwd);
}

export async function readTeamConfig(teamName: string, cwd: string): Promise<TeamConfig | null> {
  return teamReadConfig(teamName, cwd);
}

export async function saveTeamConfig(config: TeamConfig, cwd: string): Promise<void> {
  await writeAtomic(absPath(cwd, TeamPaths.config(config.name)), JSON.stringify(config, null, 2));
}

export async function writeWorkerIdentity(teamName: string, workerName: string, identity: WorkerInfo, cwd: string): Promise<void> {
  return teamWriteWorkerIdentity(teamName, workerName, identity, cwd);
}

export async function readWorkerHeartbeat(teamName: string, workerName: string, cwd: string): Promise<WorkerHeartbeat | null> {
  return teamReadWorkerHeartbeat(teamName, workerName, cwd);
}

export async function updateWorkerHeartbeat(teamName: string, workerName: string, heartbeat: WorkerHeartbeat, cwd: string): Promise<void> {
  return teamUpdateWorkerHeartbeat(teamName, workerName, heartbeat, cwd);
}

export async function readWorkerStatus(teamName: string, workerName: string, cwd: string): Promise<WorkerStatus> {
  return teamReadWorkerStatus(teamName, workerName, cwd);
}

export async function writeWorkerStatus(teamName: string, workerName: string, status: WorkerStatus, cwd: string): Promise<void> {
  await writeAtomic(absPath(cwd, TeamPaths.workerStatus(teamName, workerName)), JSON.stringify(status, null, 2));
}

export async function writeWorkerInbox(teamName: string, workerName: string, prompt: string, cwd: string): Promise<void> {
  return teamWriteWorkerInbox(teamName, workerName, prompt, cwd);
}

export async function createTask(teamName: string, task: Omit<TeamTask, 'id' | 'created_at'>, cwd: string): Promise<TeamTaskV2> {
  return teamCreateTask(teamName, task, cwd);
}

export async function readTask(teamName: string, taskId: string, cwd: string): Promise<TeamTask | null> {
  return teamReadTask(teamName, taskId, cwd);
}

export async function updateTask(teamName: string, taskId: string, patch: Partial<TeamTask>, cwd: string): Promise<TeamTask> {
  const updated = await teamUpdateTask(teamName, taskId, patch, cwd);
  if (!updated) throw new Error(`task_not_found:${taskId}`);
  return updated;
}

export async function listTasks(teamName: string, cwd: string): Promise<TeamTask[]> {
  return teamListTasks(teamName, cwd);
}

export async function computeTaskReadiness(teamName: string, taskId: string, cwd: string): Promise<TaskReadiness> {
  const task = await readTask(teamName, taskId, cwd);
  if (!task) return { ready: false, reason: 'blocked_dependency', dependencies: [] };
  const deps = task.depends_on ?? task.blocked_by ?? [];
  if (deps.length === 0) return { ready: true };
  const depTasks = await Promise.all(deps.map((dep) => readTask(teamName, dep, cwd)));
  const incomplete = deps.filter((_, index) => depTasks[index]?.status !== 'completed');
  return incomplete.length > 0 ? { ready: false, reason: 'blocked_dependency', dependencies: incomplete } : { ready: true };
}

export async function claimTask(
  teamName: string,
  taskId: string,
  workerName: string,
  expectedVersion: number | null,
  cwd: string,
): Promise<ClaimTaskResult> {
  return teamClaimTask(teamName, taskId, workerName, expectedVersion, cwd);
}

export async function transitionTaskStatus(
  teamName: string,
  taskId: string,
  from: TeamTaskStatus,
  to: TeamTaskStatus,
  claimToken: string,
  terminalData: { result?: string; error?: string } | undefined,
  cwd: string,
): Promise<TransitionTaskResult> {
  return teamTransitionTaskStatus(teamName, taskId, from, to, claimToken, cwd, terminalData);
}

export async function releaseTaskClaim(teamName: string, taskId: string, workerName: string, claimToken: string, cwd: string): Promise<ReleaseTaskClaimResult> {
  return teamReleaseTaskClaim(teamName, taskId, claimToken, workerName, cwd);
}

export async function reclaimExpiredTaskClaim(): Promise<{ ok: false; error: 'not_supported' }> {
  return { ok: false, error: 'not_supported' };
}

export async function appendTeamEvent(teamName: string, event: Omit<TeamEvent, 'event_id' | 'created_at' | 'team'>, cwd: string): Promise<TeamEvent> {
  return teamAppendEvent(teamName, event, cwd);
}

export function resolveDispatchLockTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.OMC_TEAM_DISPATCH_LOCK_TIMEOUT_MS ?? env.OMX_TEAM_DISPATCH_LOCK_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5_000;
}

export async function enqueueDispatchRequest(teamName: string, input: TeamDispatchRequestInput, cwd: string): Promise<TeamDispatchRequest> {
  const request: TeamDispatchRequest = {
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

async function readJson<T>(path: string): Promise<T | null> {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(await readFile(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

export async function listDispatchRequests(teamName: string, cwd: string): Promise<TeamDispatchRequest[]> {
  const dir = absPath(cwd, join(TeamPaths.root(teamName), 'dispatch'));
  try {
    const { readdir } = await import('fs/promises');
    const files = (await readdir(dir)).filter((file) => file.endsWith('.json'));
    const requests = await Promise.all(files.map((file) => readJson<TeamDispatchRequest>(join(dir, file))));
    return requests.filter((request): request is TeamDispatchRequest => Boolean(request));
  } catch {
    return [];
  }
}

export async function readDispatchRequest(teamName: string, requestId: string, cwd: string): Promise<TeamDispatchRequest | null> {
  return readJson<TeamDispatchRequest>(absPath(cwd, join(TeamPaths.root(teamName), 'dispatch', `${requestId}.json`)));
}

export async function transitionDispatchRequest(
  teamName: string,
  requestId: string,
  status: TeamDispatchRequestStatus,
  patch: Partial<TeamDispatchRequest>,
  cwd: string,
): Promise<TeamDispatchRequest | null> {
  const current = await readDispatchRequest(teamName, requestId, cwd);
  if (!current) return null;
  const updated = { ...current, ...patch, status, updated_at: new Date().toISOString() };
  await writeAtomic(absPath(cwd, join(TeamPaths.root(teamName), 'dispatch', `${requestId}.json`)), JSON.stringify(updated, null, 2));
  return updated;
}

export async function markDispatchRequestNotified(teamName: string, requestId: string, cwd: string): Promise<TeamDispatchRequest | null> {
  return transitionDispatchRequest(teamName, requestId, 'notified', { notified_at: new Date().toISOString() }, cwd);
}

export async function markDispatchRequestDelivered(teamName: string, requestId: string, cwd: string): Promise<TeamDispatchRequest | null> {
  return transitionDispatchRequest(teamName, requestId, 'delivered', { delivered_at: new Date().toISOString() }, cwd);
}

export async function sendDirectMessage(teamName: string, fromWorker: string, toWorker: string, body: string, cwd: string): Promise<TeamMailboxMessage> {
  return teamSendMessage(teamName, fromWorker, toWorker, body, cwd);
}

export async function broadcastMessage(teamName: string, fromWorker: string, body: string, cwd: string): Promise<TeamMailboxMessage[]> {
  return teamBroadcast(teamName, fromWorker, body, cwd);
}

export async function markMessageDelivered(teamName: string, workerName: string, messageId: string, cwd: string): Promise<boolean> {
  return teamMarkMessageDelivered(teamName, workerName, messageId, cwd);
}

export async function markMessageNotified(teamName: string, workerName: string, messageId: string, cwd: string): Promise<boolean> {
  return teamMarkMessageNotified(teamName, workerName, messageId, cwd);
}

export async function listMailboxMessages(teamName: string, workerName: string, cwd: string): Promise<TeamMailboxMessage[]> {
  return teamListMailbox(teamName, workerName, cwd);
}

export async function writeTaskApproval(approval: TaskApprovalRecord, deps: { cwd: string; teamName: string }): Promise<void> {
  return teamWriteTaskApproval(deps.teamName, approval, deps.cwd);
}

export async function readTaskApproval(taskId: string, deps: { cwd: string; teamName: string }): Promise<TaskApprovalRecord | null> {
  return teamReadTaskApproval(deps.teamName, taskId, deps.cwd);
}

export async function getTeamSummary(teamName: string, cwd: string): Promise<TeamSummary | null> {
  return teamGetSummary(teamName, cwd);
}

export async function writeShutdownRequest(teamName: string, reason: string, cwd: string): Promise<void> {
  return teamWriteShutdownRequest(teamName, 'all', reason, cwd);
}

export async function readShutdownAck(teamName: string, workerName: string, cwd: string): Promise<ShutdownAck | null> {
  return teamReadShutdownAck(teamName, workerName, cwd);
}

export async function readMonitorSnapshot(teamName: string, cwd: string): Promise<TeamMonitorSnapshotState | null> {
  return teamReadMonitorSnapshot(teamName, cwd);
}

export async function writeMonitorSnapshot(teamName: string, snapshot: TeamMonitorSnapshotState, cwd: string): Promise<void> {
  return teamWriteMonitorSnapshot(teamName, snapshot, cwd);
}

export async function readTeamPhase(teamName: string, cwd: string): Promise<TeamPhaseState | null> {
  return readJson<TeamPhaseState>(absPath(cwd, join(TeamPaths.root(teamName), 'phase.json')));
}

export async function writeTeamPhase(teamName: string, phase: TeamPhaseState, cwd: string): Promise<void> {
  await writeAtomic(absPath(cwd, join(TeamPaths.root(teamName), 'phase.json')), JSON.stringify(phase, null, 2));
}

export async function readTeamLeaderAttention(): Promise<null> { return null; }
export async function writeTeamLeaderAttention(): Promise<void> {}
export async function markTeamLeaderSessionStopped(): Promise<void> {}
export async function markTeamLeaderStopObserved(): Promise<void> {}
export async function markOwnedTeamsLeaderSessionStopped(): Promise<void> {}
export async function markOwnedTeamsLeaderStopObserved(): Promise<void> {}

export async function cleanupTeamState(teamName: string, cwd: string): Promise<void> {
  return teamCleanup(teamName, cwd);
}

export { DEFAULT_TEAM_GOVERNANCE };
