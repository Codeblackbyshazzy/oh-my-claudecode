export interface AllocationTaskInput {
    id?: string;
    subject: string;
    description: string;
    role?: string;
    blocked_by?: string[];
    filePaths?: string[];
    domains?: string[];
}
export interface AllocationWorkerInput {
    name: string;
    role?: string;
    currentLoad?: number;
}
export interface AllocationDecision {
    owner: string;
    reason: string;
}
export type TaskAllocationInput = AllocationTaskInput & {
    id: string;
};
export type WorkerAllocationInput = AllocationWorkerInput & {
    role: string;
    currentLoad: number;
};
export interface AllocationResult {
    taskId: string;
    workerName: string;
    reason: string;
}
type AssignmentHint = {
    owner: string;
    role?: string;
    subject?: string;
    description?: string;
    filePaths?: string[];
    domains?: string[];
};
export declare function chooseTaskOwner(task: AllocationTaskInput, workers: AllocationWorkerInput[], currentAssignments: AssignmentHint[]): AllocationDecision;
export declare function allocateTasksToWorkers<T extends AllocationTaskInput>(tasks: T[], workers: AllocationWorkerInput[]): Array<T & {
    owner: string;
    allocation_reason: string;
    taskId: string;
    workerName: string;
    reason: string;
}>;
export {};
//# sourceMappingURL=allocation-policy.d.ts.map