import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { drainPendingTeamDispatch, type InjectionResult } from '../../hooks/team-dispatch-hook.js';
import { initTeamState, listMailboxMessages, sendDirectMessage } from '../state.js';
import type { TeamConfig } from '../types.js';

function teamConfig(name: string, cwd: string, leaderPaneId: string | null = '%1'): TeamConfig {
  return {
    name,
    task: 'delivery smoke',
    agent_type: 'executor',
    worker_launch_mode: 'interactive',
    worker_count: 2,
    max_workers: 20,
    workers: [1, 2].map((index) => ({
      name: `worker-${index}`,
      index,
      role: 'executor',
      assigned_tasks: [],
      pane_id: `%${index + 1}`,
      working_dir: cwd,
    })),
    created_at: new Date().toISOString(),
    tmux_session: `${name}:0`,
    next_task_id: 1,
    leader_cwd: cwd,
    team_state_root: join(cwd, '.omc', 'state', 'team', name),
    workspace_mode: 'single',
    worktree_mode: 'disabled',
    leader_pane_id: leaderPaneId,
    hud_pane_id: null,
    resize_hook_name: null,
    resize_hook_target: null,
  };
}

async function writeDispatchRequest(cwd: string, teamName: string, request: Record<string, unknown>): Promise<void> {
  const dispatchDir = join(cwd, '.omc', 'state', 'team', teamName, 'dispatch');
  await mkdir(dispatchDir, { recursive: true });
  await writeFile(join(dispatchDir, 'requests.json'), JSON.stringify([{
    request_id: 'req-1',
    kind: 'mailbox',
    team_name: teamName,
    to_worker: 'worker-2',
    pane_id: '%3',
    trigger_message: 'mailbox ready',
    transport_preference: 'hook_preferred_with_fallback',
    fallback_allowed: true,
    status: 'pending',
    attempt_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...request,
  }], null, 2));
}

describe('team delivery e2e smoke', () => {
  it('drains a pending mailbox dispatch and marks the mailbox message notified', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'omc-delivery-e2e-'));
    try {
      await initTeamState(teamConfig('delivery-team', cwd), cwd);
      const message = await sendDirectMessage('delivery-team', 'worker-1', 'worker-2', 'hello', cwd);
      await writeDispatchRequest(cwd, 'delivery-team', { message_id: message.message_id });

      const injections: string[] = [];
      const result = await drainPendingTeamDispatch({
        cwd,
        injector: async (request): Promise<InjectionResult> => {
          injections.push(`${request.to_worker}:${request.trigger_message}`);
          return { ok: true, reason: 'tmux_send_keys' };
        },
      });

      expect(result).toMatchObject({ processed: 1, failed: 0 });
      expect(injections).toEqual(['worker-2:mailbox ready']);

      const requests = JSON.parse(await readFile(join(cwd, '.omc', 'state', 'team', 'delivery-team', 'dispatch', 'requests.json'), 'utf-8')) as Array<{ status: string; notified_at?: string }>;
      expect(requests[0]?.status).toBe('notified');
      expect(requests[0]?.notified_at).toBeTruthy();

      const mailbox = await listMailboxMessages('delivery-team', 'worker-2', cwd);
      expect(mailbox[0]?.notified_at).toBeTruthy();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('defers leader dispatch when no leader pane is available and records an event', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'omc-delivery-leader-defer-'));
    try {
      await initTeamState(teamConfig('delivery-defer', cwd, null), cwd);
      await writeDispatchRequest(cwd, 'delivery-defer', {
        to_worker: 'leader-fixed',
        pane_id: undefined,
        trigger_message: 'leader attention',
      });

      const result = await drainPendingTeamDispatch({ cwd });
      expect(result.skipped).toBe(1);

      const requests = JSON.parse(await readFile(join(cwd, '.omc', 'state', 'team', 'delivery-defer', 'dispatch', 'requests.json'), 'utf-8')) as Array<{ status: string; last_reason?: string }>;
      expect(requests[0]).toMatchObject({ status: 'pending', last_reason: 'leader_pane_missing_deferred' });

      const events = await readFile(join(cwd, '.omc', 'state', 'team', 'delivery-defer', 'events', 'events.ndjson'), 'utf-8');
      expect(events).toMatch(/leader_notification_deferred/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
