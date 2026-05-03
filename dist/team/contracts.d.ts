export declare const TEAM_NAME_SAFE_PATTERN: RegExp;
export declare const WORKER_NAME_SAFE_PATTERN: RegExp;
export declare const TASK_ID_SAFE_PATTERN: RegExp;
export declare const TEAM_TASK_STATUSES: readonly ["pending", "blocked", "in_progress", "completed", "failed"];
export type TeamTaskStatus = (typeof TEAM_TASK_STATUSES)[number];
export declare const TEAM_TERMINAL_TASK_STATUSES: ReadonlySet<TeamTaskStatus>;
export declare const TEAM_TASK_STATUS_TRANSITIONS: Readonly<Record<TeamTaskStatus, readonly TeamTaskStatus[]>>;
export declare function isTerminalTeamTaskStatus(status: TeamTaskStatus): boolean;
export declare function canTransitionTeamTaskStatus(from: TeamTaskStatus, to: TeamTaskStatus): boolean;
export declare const TEAM_EVENT_TYPES: readonly ["task_completed", "task_failed", "worker_state_changed", "worker_idle", "worker_stopped", "message_received", "leader_notification_deferred", "all_workers_idle", "shutdown_ack", "shutdown_gate", "shutdown_gate_forced", "ralph_cleanup_policy", "ralph_cleanup_summary", "approval_decision", "team_leader_nudge", "worker_diff_activity", "worker_diff_report", "worker_merge_report", "worker_merge_applied", "worker_merge_conflict", "worker_integration_failed", "worker_integration_attempt_requested", "worker_cherry_pick_detected", "worker_cherry_pick_applied", "worker_cherry_pick_conflict", "worker_rebase_applied", "worker_rebase_conflict", "worker_cross_rebase_applied", "worker_cross_rebase_conflict", "worker_cross_rebase_skipped", "worker_stale_diff", "worker_stale_heartbeat", "worker_stale_stdout"];
export type TeamEventType = (typeof TEAM_EVENT_TYPES)[number];
export declare const TEAM_WAKEABLE_EVENT_TYPES: ReadonlySet<TeamEventType>;
export declare function isWakeableTeamEventType(type: TeamEventType): boolean;
export declare const TEAM_TASK_APPROVAL_STATUSES: readonly ["pending", "approved", "rejected"];
export type TeamTaskApprovalStatus = (typeof TEAM_TASK_APPROVAL_STATUSES)[number];
//# sourceMappingURL=contracts.d.ts.map