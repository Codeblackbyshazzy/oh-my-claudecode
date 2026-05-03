export { resolveDispatchLockTimeoutMs } from '../state.js';
export async function withDispatchLock<T>(_teamName: string, _cwd: string, fn: () => Promise<T>): Promise<T> { return await fn(); }
