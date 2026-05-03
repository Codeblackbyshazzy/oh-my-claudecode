import { describe, it, expect } from 'vitest';
import { allocateTasksToWorkers, chooseTaskOwner } from '../allocation-policy.js';
import type { TaskAllocationInput, WorkerAllocationInput } from '../allocation-policy.js';

function makeTask(id: string, role?: string): TaskAllocationInput {
  return { id, subject: `Task ${id}`, description: `Description for task ${id}`, role };
}

function makeWorker(name: string, role: string, currentLoad = 0): WorkerAllocationInput {
  return { name, role, currentLoad };
}

describe('allocation-policy', () => {
  describe('allocateTasksToWorkers', () => {
    it('returns empty array when no tasks', () => {
      const workers = [makeWorker('w1', 'executor')];
      expect(allocateTasksToWorkers([], workers)).toEqual([]);
    });

    it('returns empty array when no workers', () => {
      const tasks = [makeTask('t1')];
      expect(allocateTasksToWorkers(tasks, [])).toEqual([]);
    });

    describe('uniform role pool (round-robin)', () => {
      it('distributes 3 tasks evenly across 3 executor workers', () => {
        const tasks = [makeTask('t1'), makeTask('t2'), makeTask('t3')];
        const workers = [
          makeWorker('w1', 'executor'),
          makeWorker('w2', 'executor'),
          makeWorker('w3', 'executor'),
        ];

        const results = allocateTasksToWorkers(tasks, workers);
        expect(results).toHaveLength(3);

        const assignees = results.map(r => r.workerName);
        const uniqueAssignees = new Set(assignees);
        // Each of the 3 workers should get exactly 1 task
        expect(uniqueAssignees.size).toBe(3);
      });

      it('respects existing load in round-robin (assigns first to least loaded)', () => {
        const tasks = [makeTask('t1'), makeTask('t2')];
        const workers = [
          makeWorker('w1', 'executor', 3), // heavily loaded
          makeWorker('w2', 'executor', 0), // idle
          makeWorker('w3', 'executor', 1),
        ];

        const results = allocateTasksToWorkers(tasks, workers);
        // w2 (load=0) should get the first task
        expect(results[0].workerName).toBe('w2');
      });

      it('does not pile all tasks on worker-1 with equal load', () => {
        const tasks = [makeTask('t1'), makeTask('t2'), makeTask('t3'), makeTask('t4')];
        const workers = [
          makeWorker('w1', 'executor'),
          makeWorker('w2', 'executor'),
        ];

        const results = allocateTasksToWorkers(tasks, workers);
        expect(results).toHaveLength(4);

        const w1Count = results.filter(r => r.workerName === 'w1').length;
        const w2Count = results.filter(r => r.workerName === 'w2').length;
        // Should be spread 2/2
        expect(w1Count).toBe(2);
        expect(w2Count).toBe(2);
      });
    });

    describe('mixed role pool', () => {
      it('routes test task to test-engineer over executor', () => {
        const tasks = [makeTask('t1', 'test-engineer')];
        const workers = [
          makeWorker('w1', 'executor'),
          makeWorker('w2', 'test-engineer'),
        ];

        const results = allocateTasksToWorkers(tasks, workers);
        expect(results).toHaveLength(1);
        expect(results[0].workerName).toBe('w2');
      });

      it('routes implementation task to executor', () => {
        const tasks = [makeTask('t1', 'executor')];
        const workers = [
          makeWorker('w1', 'executor'),
          makeWorker('w2', 'test-engineer'),
        ];

        const results = allocateTasksToWorkers(tasks, workers);
        expect(results).toHaveLength(1);
        expect(results[0].workerName).toBe('w1');
      });

      it('distributes tasks with no role hint neutrally', () => {
        const tasks = [makeTask('t1'), makeTask('t2')]; // no role hint
        const workers = [
          makeWorker('w1', 'executor'),
          makeWorker('w2', 'test-engineer'),
        ];

        const results = allocateTasksToWorkers(tasks, workers);
        expect(results).toHaveLength(2);
        // Both workers should be used (load balancing distributes neutrally)
        const assignees = new Set(results.map(r => r.workerName));
        expect(assignees.size).toBe(2);
      });

      it('2 executors + 1 test-engineer: test task goes to test-engineer', () => {
        const tasks = [makeTask('t1', 'test-engineer')];
        const workers = [
          makeWorker('w1', 'executor'),
          makeWorker('w2', 'executor'),
          makeWorker('w3', 'test-engineer'),
        ];

        const results = allocateTasksToWorkers(tasks, workers);
        expect(results[0].workerName).toBe('w3');
      });

      it('prefers less-loaded worker of matching role', () => {
        const tasks = [makeTask('t1', 'executor')];
        const workers = [
          makeWorker('w1', 'executor', 5),  // loaded
          makeWorker('w2', 'executor', 0),  // idle
          makeWorker('w3', 'test-engineer', 0),
        ];

        const results = allocateTasksToWorkers(tasks, workers);
        expect(results[0].workerName).toBe('w2');
      });
    });

    it('includes reason string in all results', () => {
      const tasks = [makeTask('t1'), makeTask('t2', 'executor')];
      const workers = [makeWorker('w1', 'executor'), makeWorker('w2', 'test-engineer')];

      const results = allocateTasksToWorkers(tasks, workers);
      for (const r of results) {
        expect(typeof r.reason).toBe('string');
        expect(r.reason.length).toBeGreaterThan(0);
      }
    });
  it('chooses matching worker role through the OMX chooseTaskOwner API', () => {
    const decision = chooseTaskOwner(
      { subject: 'write docs', description: 'document the feature', role: 'writer' },
      [
        { name: 'worker-1', role: 'executor' },
        { name: 'worker-2', role: 'writer' },
      ],
      [],
    );

    expect(decision.owner).toBe('worker-2');
    expect(decision.reason).toMatch(/matches worker role writer/);
  });

  it('clusters related file-path work on the same worker to reduce overlap', () => {
    const assignments = allocateTasksToWorkers(
      [
        {
          subject: 'Runtime integration lane',
          description: 'Implement incremental integration in src/team/runtime.ts and src/team/mcp-comm.ts',
          role: 'executor',
        },
        {
          subject: 'Runtime follow-up lane',
          description: 'Add more runtime coverage for src/team/runtime.ts conflict handling',
          role: 'executor',
        },
        {
          subject: 'Allocation lane',
          description: 'Adjust heuristics in src/team/allocation-policy.ts',
          role: 'executor',
        },
      ],
      [
        { name: 'worker-1', role: 'executor' },
        { name: 'worker-2', role: 'executor' },
        { name: 'worker-3', role: 'executor' },
      ],
    );

    expect(assignments[0].owner).toBe('worker-1');
    expect(assignments[1].owner).toBe('worker-1');
    expect(assignments[2].owner).toBe('worker-2');
    expect(assignments[1].allocation_reason).toMatch(/low-overlap file\/domain ownership/);
  });

  });
});
