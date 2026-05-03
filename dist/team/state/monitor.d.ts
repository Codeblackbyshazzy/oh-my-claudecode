export type { TeamSummary, TeamSummaryPerformance, TeamMonitorSnapshotState, TeamPhaseState } from '../types.js';
export { getTeamSummary, readMonitorSnapshot, writeMonitorSnapshot, readTeamPhase, writeTeamPhase, } from '../state.js';
export declare function readSummarySnapshot(): Promise<null>;
export declare function writeSummarySnapshot(): Promise<void>;
//# sourceMappingURL=monitor.d.ts.map