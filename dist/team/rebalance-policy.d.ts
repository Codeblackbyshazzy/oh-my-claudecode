import type { TeamTask, WorkerStatus } from './types.js';
import { type AllocationWorkerInput } from './allocation-policy.js';
export interface RebalanceWorkerInput extends AllocationWorkerInput {
    alive: boolean;
    status: WorkerStatus;
}
export interface RebalanceDecision {
    type: 'assign' | 'recommend';
    taskId?: string;
    workerName?: string;
    reason: string;
}
export interface RebalancePolicyInput {
    tasks: TeamTask[];
    workers: RebalanceWorkerInput[];
    reclaimedTaskIds: string[];
}
export declare function buildRebalanceDecisions(input: RebalancePolicyInput): RebalanceDecision[];
//# sourceMappingURL=rebalance-policy.d.ts.map