import type { TeamEvent } from './types.js';
import { appendTeamEvent } from '../state.js';
interface TeamEventReadOptions {
    afterEventId?: string;
    wakeableOnly?: boolean;
    type?: TeamEvent['type'] | 'worker_idle';
    worker?: string;
    taskId?: string;
}
export declare function readTeamEvents(teamName: string, cwd: string, opts?: TeamEventReadOptions): Promise<TeamEvent[]>;
export declare function getLatestTeamEventCursor(teamName: string, cwd: string): Promise<string>;
export declare function waitForTeamEvent(teamName: string, cwd: string, opts: {
    afterEventId?: string;
    timeoutMs: number;
    pollMs?: number;
    wakeableOnly?: boolean;
    type?: TeamEvent['type'] | 'worker_idle';
    worker?: string;
    taskId?: string;
}): Promise<{
    status: 'event' | 'timeout';
    event?: TeamEvent;
    cursor: string;
}>;
export { appendTeamEvent };
//# sourceMappingURL=events.d.ts.map