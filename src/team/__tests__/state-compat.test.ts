import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  initTeamState,
  readTeamConfig,
  writeWorkerStatus,
  readWorkerStatus,
  enqueueDispatchRequest,
  readDispatchRequest,
} from '../state.js';
import type { TeamConfig } from '../types.js';

function config(): TeamConfig {
  return {
    name: 'demo',
    task: 'demo task',
    agent_type: 'executor',
    worker_launch_mode: 'prompt',
    worker_count: 1,
    max_workers: 1,
    workers: [{ name: 'worker-1', index: 1, role: 'executor', assigned_tasks: [] }],
    created_at: '2026-05-02T00:00:00.000Z',
    tmux_session: 'demo',
    next_task_id: 1,
    leader_pane_id: null,
    hud_pane_id: null,
    resize_hook_name: null,
    resize_hook_target: null,
  };
}

describe('state compatibility facade', () => {
  it('exposes OMX state API names over OMC team paths', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'omc-state-compat-'));
    try {
      await initTeamState(config(), cwd);
      await expect(readTeamConfig('demo', cwd)).resolves.toMatchObject({ name: 'demo' });

      await writeWorkerStatus('demo', 'worker-1', { state: 'idle', updated_at: '2026-05-02T00:00:00.000Z' }, cwd);
      await expect(readWorkerStatus('demo', 'worker-1', cwd)).resolves.toMatchObject({ state: 'idle' });

      const request = await enqueueDispatchRequest('demo', {
        kind: 'nudge',
        to_worker: 'worker-1',
        trigger_message: 'ping',
      }, cwd);
      await expect(readDispatchRequest('demo', request.request_id, cwd)).resolves.toMatchObject({ to_worker: 'worker-1' });

      const configText = await readFile(join(cwd, '.omc', 'state', 'team', 'demo', 'config.json'), 'utf-8');
      expect(JSON.parse(configText).name).toBe('demo');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
