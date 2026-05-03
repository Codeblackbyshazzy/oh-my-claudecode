export type WorktreeMode = {
    enabled: false;
} | {
    enabled: true;
    detached: true;
    name: null;
} | {
    enabled: true;
    detached: false;
    name: string;
};
export interface ParsedWorktreeMode {
    mode: WorktreeMode;
    remainingArgs: string[];
}
export interface WorktreePlanInput {
    cwd: string;
    scope: 'launch' | 'team' | 'autoresearch';
    mode: WorktreeMode;
    teamName?: string;
    workerName?: string;
    worktreeTag?: string;
}
export interface PlannedWorktreeTarget {
    enabled: true;
    scope: 'launch' | 'team' | 'autoresearch';
    repoRoot: string;
    worktreePath: string;
    detached: boolean;
    baseRef: string;
    branchName: string | null;
}
export interface EnsureWorktreeResult {
    enabled: true;
    repoRoot: string;
    worktreePath: string;
    detached: boolean;
    branchName: string | null;
    created: boolean;
    reused: boolean;
    createdBranch: boolean;
    /** True when the worktree had uncommitted changes at launch time. */
    dirty?: boolean;
}
export interface EnsureWorktreeOptions {
    allowDirtyReuse?: boolean;
}
export declare function isGitRepository(cwd: string): boolean;
export declare function isWorktreeDirty(worktreePath: string): boolean;
export declare function readWorkspaceStatusLines(cwd: string): string[];
export declare function assertCleanLeaderWorkspaceForWorkerWorktrees(cwd: string): void;
export declare function parseWorktreeMode(args: string[]): ParsedWorktreeMode;
export declare function planWorktreeTarget(input: WorktreePlanInput): PlannedWorktreeTarget | {
    enabled: false;
};
export declare function ensureWorktree(plan: PlannedWorktreeTarget | {
    enabled: false;
}, options?: EnsureWorktreeOptions): EnsureWorktreeResult | {
    enabled: false;
};
export interface RollbackWorktreeOptions {
    /** When true, skip `git branch -D` for branches created during provisioning (ralph policy). */
    skipBranchDeletion?: boolean;
}
export declare function rollbackProvisionedWorktrees(results: Array<EnsureWorktreeResult | {
    enabled: false;
}>, options?: RollbackWorktreeOptions): Promise<void>;
export declare function removeWorktreeForce(repoRoot: string, worktreePath: string): Promise<void>;
//# sourceMappingURL=worktree.d.ts.map