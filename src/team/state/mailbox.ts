export type { TeamMailboxMessage, TeamMailbox } from '../types.js';
export { sendDirectMessage, broadcastMessage, markMessageDelivered, markMessageNotified, listMailboxMessages } from '../state.js';
export function normalizeBridgeMailboxMessage<T>(record: T): T { return record; }
