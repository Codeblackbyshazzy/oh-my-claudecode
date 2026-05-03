export declare function withScalingLock<T>(_teamName: string, _cwd: string, fn: () => Promise<T>): Promise<T>;
export declare function withTeamLock<T>(_teamName: string, _cwd: string, fn: () => Promise<T>): Promise<T>;
export declare function withTaskClaimLock<T>(_teamName: string, _taskId: string, _cwd: string, fn: () => Promise<T>): Promise<{
    ok: true;
    value: T;
} | {
    ok: false;
}>;
export declare function withMailboxLock<T>(_teamName: string, _workerName: string, _cwd: string, fn: () => Promise<T>): Promise<T>;
//# sourceMappingURL=locks.d.ts.map