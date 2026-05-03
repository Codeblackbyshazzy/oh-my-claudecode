import { describe, expect, it } from 'vitest';
import * as teamOps from '../team-ops.js';
import * as state from '../state.js';

const EXPECTED_GATEWAY_EXPORTS = {
  DEFAULT_MAX_WORKERS: 'DEFAULT_MAX_WORKERS',
  ABSOLUTE_MAX_WORKERS: 'ABSOLUTE_MAX_WORKERS',
  teamInit: 'initTeamState',
  teamReadConfig: 'readTeamConfig',
  teamReadManifest: 'readTeamManifestV2',
  teamWriteManifest: 'writeTeamManifestV2',
  teamSaveConfig: 'saveTeamConfig',
  teamCleanup: 'cleanupTeamState',
  teamMigrateV1ToV2: 'migrateV1ToV2',
  teamNormalizePolicy: 'normalizeTeamPolicy',
  teamNormalizeGovernance: 'normalizeTeamGovernance',
  teamWriteWorkerIdentity: 'writeWorkerIdentity',
  teamReadWorkerHeartbeat: 'readWorkerHeartbeat',
  teamUpdateWorkerHeartbeat: 'updateWorkerHeartbeat',
  teamReadWorkerStatus: 'readWorkerStatus',
  teamWriteWorkerInbox: 'writeWorkerInbox',
  teamCreateTask: 'createTask',
  teamReadTask: 'readTask',
  teamListTasks: 'listTasks',
  teamUpdateTask: 'updateTask',
  teamClaimTask: 'claimTask',
  teamReleaseTaskClaim: 'releaseTaskClaim',
  teamReclaimExpiredTaskClaim: 'reclaimExpiredTaskClaim',
  teamTransitionTaskStatus: 'transitionTaskStatus',
  teamComputeTaskReadiness: 'computeTaskReadiness',
  teamSendMessage: 'sendDirectMessage',
  teamBroadcast: 'broadcastMessage',
  teamListMailbox: 'listMailboxMessages',
  teamMarkMessageDelivered: 'markMessageDelivered',
  teamMarkMessageNotified: 'markMessageNotified',
  teamEnqueueDispatchRequest: 'enqueueDispatchRequest',
  teamListDispatchRequests: 'listDispatchRequests',
  teamReadDispatchRequest: 'readDispatchRequest',
  teamTransitionDispatchRequest: 'transitionDispatchRequest',
  teamMarkDispatchRequestNotified: 'markDispatchRequestNotified',
  teamMarkDispatchRequestDelivered: 'markDispatchRequestDelivered',
  teamAppendEvent: 'appendTeamEvent',
  teamReadTaskApproval: 'readTaskApproval',
  teamWriteTaskApproval: 'writeTaskApproval',
  teamGetSummary: 'getTeamSummary',
  teamWriteShutdownRequest: 'writeShutdownRequest',
  teamReadShutdownAck: 'readShutdownAck',
  teamReadMonitorSnapshot: 'readMonitorSnapshot',
  teamWriteMonitorSnapshot: 'writeMonitorSnapshot',
  teamReadPhase: 'readTeamPhase',
  teamWritePhase: 'writeTeamPhase',
  teamReadLeaderAttention: 'readTeamLeaderAttention',
  teamWriteLeaderAttention: 'writeTeamLeaderAttention',
  teamMarkLeaderSessionStopped: 'markTeamLeaderSessionStopped',
  teamMarkOwnedTeamsLeaderSessionStopped: 'markOwnedTeamsLeaderSessionStopped',
  teamWriteWorkerStatus: 'writeWorkerStatus',
  teamWithScalingLock: 'withScalingLock',
  resolveDispatchLockTimeoutMs: 'resolveDispatchLockTimeoutMs',
  writeAtomic: 'writeAtomic',
} as const;

describe('team/team-ops module contract', () => {
  it('exposes the OMX-aligned gateway surface expected by API consumers', () => {
    const teamOpsModule = teamOps as Record<string, unknown>;

    for (const alias of Object.keys(EXPECTED_GATEWAY_EXPORTS)) {
      expect(teamOpsModule[alias], `team-ops export ${alias}`).toBeDefined();
    }
  });

  it('keeps gateway export kinds aligned with the state compatibility surface', () => {
    const teamOpsModule = teamOps as Record<string, unknown>;
    const stateModule = state as Record<string, unknown>;

    for (const [alias, stateName] of Object.entries(EXPECTED_GATEWAY_EXPORTS)) {
      if (!(stateName in stateModule)) continue;
      expect(typeof teamOpsModule[alias], `${alias} kind`).toBe(typeof stateModule[stateName]);
    }
  });
});
