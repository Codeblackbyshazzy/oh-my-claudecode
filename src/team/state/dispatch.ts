import type { TeamDispatchRequest as BridgeDispatchRecord } from '../types.js';
export type { TeamDispatchRequestKind, TeamDispatchTransportPreference, TeamDispatchRequest, TeamDispatchRequestInput } from '../types.js';
export {
  enqueueDispatchRequest,
  listDispatchRequests,
  readDispatchRequest,
  transitionDispatchRequest,
  markDispatchRequestNotified,
  markDispatchRequestDelivered,
} from '../state.js';
export function normalizeDispatchRequest<T>(value: T): T { return value; }
export function normalizeBridgeDispatchRecord(record: BridgeDispatchRecord): BridgeDispatchRecord { return record; }
export async function markDispatchRequestFailed(teamName: string, requestId: string, reason: string, cwd: string) {
  const { transitionDispatchRequest } = await import('../state.js');
  return transitionDispatchRequest(teamName, requestId, 'failed', { failed_at: new Date().toISOString(), last_reason: reason }, cwd);
}
