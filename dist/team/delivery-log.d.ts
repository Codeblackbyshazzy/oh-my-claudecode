export type TeamDeliveryEventName = 'mailbox_created' | 'dispatch_attempted' | 'dispatch_result' | 'startup_timing' | 'delivered' | 'mark_delivered' | 'nudge_triggered';
export type TeamDeliveryResult = 'created' | 'queued' | 'ok' | 'confirmed' | 'notified' | 'updated' | 'missing' | 'retry' | 'deferred' | 'suppressed' | 'sent' | 'failed';
export interface TeamDeliveryLogEvent {
    event: TeamDeliveryEventName;
    source: string;
    team: string;
    transport?: string;
    result?: TeamDeliveryResult;
    [key: string]: unknown;
}
export declare function teamDeliveryLogPath(logsDir: string, now?: Date): string;
export declare function appendTeamDeliveryLog(logsDir: string, event: TeamDeliveryLogEvent): Promise<void>;
export declare function appendTeamDeliveryLogForCwd(cwd: string, event: TeamDeliveryLogEvent): Promise<void>;
//# sourceMappingURL=delivery-log.d.ts.map