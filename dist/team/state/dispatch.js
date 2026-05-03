export { enqueueDispatchRequest, listDispatchRequests, readDispatchRequest, transitionDispatchRequest, markDispatchRequestNotified, markDispatchRequestDelivered, } from '../state.js';
export function normalizeDispatchRequest(value) { return value; }
export function normalizeBridgeDispatchRecord(record) { return record; }
export async function markDispatchRequestFailed(teamName, requestId, reason, cwd) {
    const { transitionDispatchRequest } = await import('../state.js');
    return transitionDispatchRequest(teamName, requestId, 'failed', { failed_at: new Date().toISOString(), last_reason: reason }, cwd);
}
//# sourceMappingURL=dispatch.js.map