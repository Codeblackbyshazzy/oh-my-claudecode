export async function withScalingLock<T>(_teamName: string, _cwd: string, fn: () => Promise<T>): Promise<T> {
  return await fn();
}
export async function withTeamLock<T>(_teamName: string, _cwd: string, fn: () => Promise<T>): Promise<T> {
  return await fn();
}
export async function withTaskClaimLock<T>(_teamName: string, _taskId: string, _cwd: string, fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  return { ok: true, value: await fn() };
}
export async function withMailboxLock<T>(_teamName: string, _workerName: string, _cwd: string, fn: () => Promise<T>): Promise<T> {
  return await fn();
}
