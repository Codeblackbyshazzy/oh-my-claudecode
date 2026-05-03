import type { ApprovedRepositoryContextSummary } from '../planning/artifacts.js';
import { type TeamDagWorkerCountSource } from './dag-schema.js';
export interface LegacyTeamExecutionPlanInput {
    task: string;
    workerCount: number;
    agentType: string;
    explicitAgentType: boolean;
    explicitWorkerCount: boolean;
    cwd: string;
    buildLegacyPlan: (task: string, workerCount: number, agentType: string, explicitAgentType: boolean, explicitWorkerCount: boolean) => RepoAwareTeamExecutionPlan;
    allowDagHandoff?: boolean;
    approvedRepositoryContextSummary?: ApprovedRepositoryContextSummary;
}
export interface RepoAwareTask {
    subject: string;
    description: string;
    owner: string;
    role?: string;
    blocked_by?: string[];
    depends_on?: string[];
    symbolic_depends_on?: string[];
    requires_code_change?: boolean;
    filePaths?: string[];
    domains?: string[];
    lane?: string;
    allocation_reason?: string;
    symbolic_id?: string;
}
export interface TeamDecompositionMetadata {
    decomposition_source: 'dag_sidecar' | 'dag_markdown' | 'legacy_text';
    dag_artifact_path?: string;
    dag_resolution_warning?: string;
    fallback_reason?: string;
    worker_count_requested: number;
    worker_count_effective: number;
    worker_count_source: TeamDagWorkerCountSource;
    ready_lane_count: number;
    useful_lane_count: number;
    allocation_reasons: Record<string, string>;
    node_dependencies?: Record<string, string[]>;
    node_id_to_task_id?: Record<string, string>;
    task_hints?: Record<string, TaskHintSummary>;
    approved_context_summary?: ApprovedRepositoryContextSummary;
}
export interface TaskHintSummary {
    node_id?: string;
    lane?: string;
    filePaths?: string[];
    domains?: string[];
    depends_on?: string[];
    symbolic_depends_on?: string[];
    allocation_reason?: string;
}
export interface RepoAwareTeamExecutionPlan {
    workerCount: number;
    tasks: RepoAwareTask[];
    metadata?: TeamDecompositionMetadata;
}
export declare function remapRepoAwareDecompositionMetadataToCreatedTasks(metadata: TeamDecompositionMetadata, plannedTasks: Array<Pick<RepoAwareTask, 'symbolic_id' | 'symbolic_depends_on' | 'lane' | 'filePaths' | 'domains' | 'allocation_reason'>>, createdTasks: Array<{
    id: string;
}>): TeamDecompositionMetadata;
export declare function buildRepoAwareTeamExecutionPlan(input: LegacyTeamExecutionPlanInput): RepoAwareTeamExecutionPlan;
//# sourceMappingURL=repo-aware-decomposition.d.ts.map