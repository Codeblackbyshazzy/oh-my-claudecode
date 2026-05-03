export async function withScalingLock(_teamName, _cwd, fn) {
    return await fn();
}
export async function withTeamLock(_teamName, _cwd, fn) {
    return await fn();
}
export async function withTaskClaimLock(_teamName, _taskId, _cwd, fn) {
    return { ok: true, value: await fn() };
}
export async function withMailboxLock(_teamName, _workerName, _cwd, fn) {
    return await fn();
}
//# sourceMappingURL=locks.js.map