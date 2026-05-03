export type CurrentTaskStatus = 'active' | 'merged' | 'closed' | 'superseded';
export interface CurrentTaskBaselineEntry {
    branch_name: string;
    worktree_path: string | null;
    base_ref?: string;
    issue_number?: number;
    pr_number?: number;
    pr_url?: string;
    status: CurrentTaskStatus;
    created_at: string;
    updated_at: string;
}
interface CurrentTaskBaselineFile {
    version: 1;
    tasks: CurrentTaskBaselineEntry[];
}
export interface UpsertCurrentTaskBaselineInput {
    branch_name: string;
    worktree_path?: string | null;
    base_ref?: string;
    issue_number?: number;
    pr_number?: number;
    pr_url?: string;
    status?: CurrentTaskStatus;
}
export declare function readCurrentTaskBaseline(repoRoot: string): CurrentTaskBaselineFile;
export declare function listActiveCurrentTasks(repoRoot: string): CurrentTaskBaselineEntry[];
export declare function findActiveCurrentTaskByBranch(repoRoot: string, branchName: string): CurrentTaskBaselineEntry | null;
export declare function upsertCurrentTaskBaseline(repoRoot: string, input: UpsertCurrentTaskBaselineInput): CurrentTaskBaselineEntry;
export declare function assertCurrentTaskBranchAvailable(repoRoot: string, branchName: string, requestedWorktreePath: string): void;
export {};
//# sourceMappingURL=current-task-baseline.d.ts.map