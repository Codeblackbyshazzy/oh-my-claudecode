import { describe, expect, it } from 'vitest';
import {
  buildLegacyTeamDeprecationHint,
  resolveTeamApiCliCommand,
} from '../api-interop.js';

describe('team api command dialect resolution', () => {
  it('defaults to omc team api', () => {
    expect(resolveTeamApiCliCommand({} as NodeJS.ProcessEnv)).toBe('omc team api');
  });

  it('keeps OMC command guidance even when accepting OMX compatibility env aliases', () => {
    expect(resolveTeamApiCliCommand({
      OMX_TEAM_WORKER: 'demo-team/worker-1',
    } as NodeJS.ProcessEnv)).toBe('omc team api');

    expect(resolveTeamApiCliCommand({
      OMX_TEAM_STATE_ROOT: '/tmp/project/.omx/state',
    } as NodeJS.ProcessEnv)).toBe('omc team api');
  });

  it('prefers omc team api when both contexts are present', () => {
    expect(resolveTeamApiCliCommand({
      OMC_TEAM_WORKER: 'demo-team/worker-1',
      OMX_TEAM_WORKER: 'demo-team/worker-2',
    } as NodeJS.ProcessEnv)).toBe('omc team api');
  });

  it('builds legacy deprecation hint with canonical omc command in OMX compatibility context', () => {
    const hint = buildLegacyTeamDeprecationHint(
      'team_claim_task',
      { team_name: 'demo', task_id: '1', worker: 'worker-1' },
      { OMX_TEAM_WORKER: 'demo/worker-1' } as NodeJS.ProcessEnv,
    );
    expect(hint).toContain('Use CLI interop: omc team api claim-task');
  });
});
