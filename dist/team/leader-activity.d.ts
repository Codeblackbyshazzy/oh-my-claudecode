interface LeaderRuntimeSignalStatus {
    source: 'hud' | 'leader_runtime_activity' | 'leader_branch_git_activity';
    at: string | null;
    ms: number;
    valid: boolean;
    fresh: boolean;
}
export declare function readBranchGitActivityMsForPath(cwd: string): Promise<number>;
export declare function leaderRuntimeActivityPath(cwd: string): string;
export declare function recordLeaderRuntimeActivity(cwd: string, source: string, teamName?: string, nowIso?: string): Promise<void>;
export declare function readLeaderRuntimeSignalStatuses(stateDir: string, thresholdMs: number, nowMs: number): Promise<LeaderRuntimeSignalStatus[]>;
export declare function readLatestLeaderActivityMsFromStateDir(stateDir: string): Promise<number>;
export declare function isLeaderRuntimeStale(stateDir: string, thresholdMs: number, nowMs: number): Promise<boolean>;
export {};
//# sourceMappingURL=leader-activity.d.ts.map