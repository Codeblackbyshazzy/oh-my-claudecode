import type { TeamDispatchRequest as BridgeDispatchRecord } from '../types.js';
export type { TeamDispatchRequestKind, TeamDispatchTransportPreference, TeamDispatchRequest, TeamDispatchRequestInput } from '../types.js';
export { enqueueDispatchRequest, listDispatchRequests, readDispatchRequest, transitionDispatchRequest, markDispatchRequestNotified, markDispatchRequestDelivered, } from '../state.js';
export declare function normalizeDispatchRequest<T>(value: T): T;
export declare function normalizeBridgeDispatchRecord(record: BridgeDispatchRecord): BridgeDispatchRecord;
export declare function markDispatchRequestFailed(teamName: string, requestId: string, reason: string, cwd: string): Promise<BridgeDispatchRecord | null>;
//# sourceMappingURL=dispatch.d.ts.map