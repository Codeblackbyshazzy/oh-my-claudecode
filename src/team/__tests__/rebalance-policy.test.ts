import { describe, expect, it } from 'vitest';
import { buildRebalanceDecisions, type RebalanceWorkerInput } from '../rebalance-policy.js';
import type { TeamTask } from '../types.js';

function task(id: string, patch: Partial<TeamTask> = {}): TeamTask {
  return {
    id,
    subject: `Task ${id}`,
    description: `Description ${id}`,
    status: 'pending',
    created_at: '2026-05-02T00:00:00.000Z',
    ...patch,
  };
}

function worker(name: string, state: RebalanceWorkerInput['status']['state'] = 'idle', role = 'executor'): RebalanceWorkerInput {
  return {
    name,
    role,
    alive: true,
    status: { state, updated_at: '2026-05-02T00:00:00.000Z' },
  };
}

describe('rebalance-policy OMX parity surface', () => {
  it('assigns unowned ready pending tasks to available workers', () => {
    const decisions = buildRebalanceDecisions({
      tasks: [task('1', { role: 'executor' })],
      workers: [worker('worker-1')],
      reclaimedTaskIds: [],
    });

    expect(decisions).toEqual([{
      type: 'assign',
      taskId: '1',
      workerName: 'worker-1',
      reason: expect.stringContaining('idle worker pickup'),
    }]);
  });

  it('prioritizes reclaimed tasks and completed dependencies', () => {
    const decisions = buildRebalanceDecisions({
      tasks: [
        task('1', { status: 'completed' }),
        task('2', { depends_on: ['1'] }),
        task('3', { depends_on: ['9'] }),
      ],
      workers: [worker('worker-1'), worker('worker-2')],
      reclaimedTaskIds: ['2'],
    });

    expect(decisions).toHaveLength(1);
    expect(decisions[0].taskId).toBe('2');
    expect(decisions[0].reason).toContain('reclaimed work is ready');
  });

  it('ignores unavailable workers and already-owned pending work', () => {
    const decisions = buildRebalanceDecisions({
      tasks: [task('1', { owner: 'worker-9' }), task('2')],
      workers: [
        { ...worker('worker-1', 'working'), alive: true },
        { ...worker('worker-2', 'idle'), alive: false },
      ],
      reclaimedTaskIds: [],
    });

    expect(decisions).toEqual([]);
  });
});
