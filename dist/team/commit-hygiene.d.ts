import type { TeamConfig, TeamTask } from './types.js';
export type TeamOperationalCommitKind = 'auto_checkpoint' | 'integration_merge' | 'integration_cherry_pick' | 'cross_rebase' | 'worker_clean_rebase' | 'leader_integration_attempt' | 'shutdown_checkpoint' | 'shutdown_merge';
export type TeamOperationalCommitStatus = 'applied' | 'noop' | 'conflict' | 'skipped';
export declare const TEAM_OPERATIONAL_COMMIT_KINDS: readonly ["auto_checkpoint", "integration_merge", "integration_cherry_pick", "cross_rebase", "worker_clean_rebase", "leader_integration_attempt", "shutdown_checkpoint", "shutdown_merge"];
export declare const TEAM_OPERATIONAL_COMMIT_STATUSES: readonly ["applied", "noop", "conflict", "skipped"];
export interface TeamOperationalCommitEntry {
    recorded_at: string;
    operation: TeamOperationalCommitKind;
    worker_name: string;
    task_id?: string;
    status: TeamOperationalCommitStatus;
    operational_commit?: string | null;
    source_commit?: string | null;
    leader_head_before?: string | null;
    leader_head_after?: string | null;
    worker_head_before?: string | null;
    worker_head_after?: string | null;
    worktree_path?: string;
    report_path?: string;
    detail?: string;
}
export interface TeamCommitHygieneLedger {
    version: 1;
    team_name: string;
    updated_at: string;
    runtime_commits_are_scaffolding: true;
    entries: TeamOperationalCommitEntry[];
}
export interface TeamCommitHygieneTaskSummary {
    id: string;
    subject: string;
    owner?: string;
    status: string;
    description: string;
    result_excerpt?: string;
    error_excerpt?: string;
}
export interface TeamCommitHygieneVocabularyTerm {
    value: string;
    label: string;
    description: string;
}
export interface TeamCommitHygieneVocabulary {
    operational_commit_kinds: TeamCommitHygieneVocabularyTerm[];
    operational_commit_statuses: TeamCommitHygieneVocabularyTerm[];
}
export interface TeamCommitHygieneContext {
    version: 1;
    team_name: string;
    generated_at: string;
    lore_commit_protocol_required: true;
    runtime_commits_are_scaffolding: true;
    vocabulary: TeamCommitHygieneVocabulary;
    task_summary: TeamCommitHygieneTaskSummary[];
    operational_entries: TeamOperationalCommitEntry[];
    recommended_next_steps: string[];
    leader_finalization_prompt: string;
}
export interface TeamCommitHygieneArtifactPaths {
    jsonPath: string;
    markdownPath: string;
}
/**
 * Commit-hygiene reports are leader-facing review artifacts, so they must be
 * rooted at the leader workspace even when runtime reconciliation is triggered
 * from a worker worktree or an explicit shared team state root.
 */
export declare function resolveTeamCommitHygieneArtifactCwd(config: Pick<TeamConfig, 'leader_cwd' | 'team_state_root' | 'workers'> | null | undefined, cwd: string): string;
export declare function resolveTeamCommitHygieneArtifactPaths(teamName: string, cwd: string): TeamCommitHygieneArtifactPaths;
export declare function readTeamCommitHygieneLedger(teamName: string, cwd: string): Promise<TeamCommitHygieneLedger>;
export declare function appendTeamCommitHygieneEntries(teamName: string, entries: TeamOperationalCommitEntry[], cwd: string): Promise<TeamCommitHygieneLedger>;
export declare function buildTeamCommitHygieneContext(params: {
    teamName: string;
    tasks: TeamTask[];
    ledger: TeamCommitHygieneLedger;
}): TeamCommitHygieneContext;
export declare function renderTeamCommitHygieneMarkdown(context: TeamCommitHygieneContext): string;
export declare function writeTeamCommitHygieneContext(teamName: string, context: TeamCommitHygieneContext, cwd: string): Promise<TeamCommitHygieneArtifactPaths>;
//# sourceMappingURL=commit-hygiene.d.ts.map