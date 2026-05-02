import { existsSync } from 'node:fs';
import { relative } from 'node:path';
import { allocateTasksToWorkers } from './allocation-policy.js';
import { readTeamDagHandoffForLatestPlan } from './dag-schema.js';
const DEFAULT_MAX_WORKERS = 20;
const IMPLEMENTATION_LANE_PATTERN = /\b(?:impl|implementation|code|build|feature|fix|refactor)\b/i;
const VERIFICATION_LANE_PATTERN = /\b(?:verify|verification|test|qa|review)\b/i;
function normalizePath(path) {
    return path.replace(/^\.\//, '');
}
function pathExists(cwd, path) {
    return existsSync(`${cwd}/${normalizePath(path)}`);
}
function inferDomains(node) {
    const domains = new Set(node.domains ?? []);
    for (const path of node.filePaths ?? []) {
        const normalized = normalizePath(path);
        const first = normalized.split('/')[0];
        if (first)
            domains.add(first);
        const base = normalized.split('/').pop()?.replace(/\.[^.]+$/, '');
        if (base)
            domains.add(base);
    }
    return [...domains];
}
function enrichNodeDescription(node, cwd) {
    const parts = [node.description];
    const files = (node.filePaths ?? []).map(normalizePath);
    if (files.length > 0) {
        const existing = files.filter((file) => pathExists(cwd, file));
        const missing = files.filter((file) => !pathExists(cwd, file));
        parts.push(`File scope: ${files.join(', ')}`);
        if (existing.length > 0)
            parts.push(`Existing paths: ${existing.map((file) => relative(cwd, `${cwd}/${file}`)).join(', ')}`);
        if (missing.length > 0)
            parts.push(`Planned/new paths: ${missing.join(', ')}`);
    }
    const domains = inferDomains(node);
    if (domains.length > 0)
        parts.push(`Domains: ${domains.join(', ')}`);
    if (node.lane)
        parts.push(`Lane: ${node.lane}`);
    if (node.acceptance?.length)
        parts.push(`Acceptance: ${node.acceptance.join('; ')}`);
    return parts.join('\n');
}
function topologicalSort(nodes) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const inputIndex = new Map(nodes.map((node, index) => [node.id, index]));
    const indegree = new Map(nodes.map((node) => [node.id, 0]));
    const outgoing = new Map();
    for (const node of nodes) {
        for (const dep of node.depends_on ?? []) {
            indegree.set(node.id, (indegree.get(node.id) ?? 0) + 1);
            outgoing.set(dep, [...(outgoing.get(dep) ?? []), node.id]);
        }
    }
    const ready = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0);
    const sorted = [];
    while (ready.length > 0) {
        ready.sort((a, b) => (inputIndex.get(a.id) ?? 0) - (inputIndex.get(b.id) ?? 0));
        const node = ready.shift();
        sorted.push(node);
        for (const next of outgoing.get(node.id) ?? []) {
            indegree.set(next, (indegree.get(next) ?? 0) - 1);
            if ((indegree.get(next) ?? 0) === 0)
                ready.push(byId.get(next));
        }
    }
    if (sorted.length !== nodes.length)
        throw new Error('Team DAG contains a cycle');
    return sorted;
}
function firstReadyLaneCount(nodes) {
    const ready = nodes.filter((node) => (node.depends_on?.length ?? 0) === 0);
    if (ready.length === 0)
        return 1;
    const conflictGroups = new Set();
    let noFileCount = 0;
    for (const node of ready) {
        const files = node.filePaths ?? [];
        if (files.length === 0) {
            noFileCount += 1;
            continue;
        }
        conflictGroups.add(files.map(normalizePath).sort().join('|'));
    }
    return Math.max(1, conflictGroups.size + noFileCount);
}
function hasImplementationWork(nodes) {
    return nodes.some((node) => {
        if (node.requires_code_change === true)
            return true;
        const text = `${node.lane ?? ''} ${node.role ?? ''} ${node.subject} ${node.description}`;
        return IMPLEMENTATION_LANE_PATTERN.test(text) && !VERIFICATION_LANE_PATTERN.test(text);
    });
}
function usefulLaneCount(nodes, readyLaneCount, reserveVerification) {
    const laneLabels = new Set(nodes.map((node) => node.lane?.trim()).filter(Boolean));
    const base = Math.max(readyLaneCount, laneLabels.size || readyLaneCount);
    if (reserveVerification && hasImplementationWork(nodes))
        return Math.max(base, Math.min(nodes.length, readyLaneCount + 1));
    return base;
}
function resolveWorkerCount(params) {
    const policy = params.dag.worker_policy;
    const source = params.explicitWorkerCount
        ? 'cli-explicit'
        : policy?.count_source ?? (policy?.requested_count ? 'plan-suggested' : 'default-derived');
    const requested = params.explicitWorkerCount
        ? params.requested
        : policy?.requested_count ?? params.requested;
    const hardCap = Math.min(DEFAULT_MAX_WORKERS, policy?.max_count ?? DEFAULT_MAX_WORKERS);
    if (source === 'cli-explicit') {
        const cap = policy?.strict_max_count === true ? hardCap : DEFAULT_MAX_WORKERS;
        return { count: Math.max(1, Math.min(requested, cap)), source };
    }
    return {
        count: Math.max(1, Math.min(requested, hardCap, params.usefulLaneCount)),
        source,
    };
}
function buildFromDag(input, resolution) {
    const sorted = topologicalSort(resolution.dag.nodes);
    const readyLaneCount = firstReadyLaneCount(sorted);
    const useful = usefulLaneCount(sorted, readyLaneCount, resolution.dag.worker_policy?.reserve_verification_lane !== false);
    const countPolicy = resolveWorkerCount({
        requested: input.workerCount,
        explicitWorkerCount: input.explicitWorkerCount,
        dag: resolution.dag,
        readyLaneCount,
        usefulLaneCount: useful,
    });
    const workers = Array.from({ length: countPolicy.count }, (_, index) => ({
        name: `worker-${index + 1}`,
        role: input.explicitAgentType ? input.agentType : undefined,
    }));
    const allocationInput = sorted.map((node) => ({
        subject: node.subject,
        description: enrichNodeDescription(node, input.cwd),
        role: input.explicitAgentType ? input.agentType : node.role,
        blocked_by: node.depends_on ?? [],
        symbolic_depends_on: node.depends_on ?? [],
        requires_code_change: node.requires_code_change,
        filePaths: node.filePaths,
        domains: inferDomains(node),
        lane: node.lane,
        symbolic_id: node.id,
    }));
    const allocated = allocateTasksToWorkers(allocationInput, workers);
    const allocationReasons = {};
    const tasks = allocated.map((task) => {
        allocationReasons[task.symbolic_id] = task.allocation_reason;
        const { blocked_by: _symbolicBlockedBy, ...runtimeTask } = task;
        return runtimeTask;
    });
    const nodeDependencies = Object.fromEntries(sorted.map((node) => [node.id, node.depends_on ?? []]));
    return {
        workerCount: countPolicy.count,
        tasks,
        metadata: {
            decomposition_source: resolution.source === 'sidecar' ? 'dag_sidecar' : 'dag_markdown',
            dag_artifact_path: resolution.path,
            dag_resolution_warning: resolution.warning,
            worker_count_requested: input.explicitWorkerCount
                ? input.workerCount
                : resolution.dag.worker_policy?.requested_count ?? input.workerCount,
            worker_count_effective: countPolicy.count,
            worker_count_source: countPolicy.source,
            ready_lane_count: readyLaneCount,
            useful_lane_count: useful,
            allocation_reasons: allocationReasons,
            node_dependencies: nodeDependencies,
            ...(input.approvedRepositoryContextSummary ? { approved_context_summary: input.approvedRepositoryContextSummary } : {}),
        },
    };
}
export function remapRepoAwareDecompositionMetadataToCreatedTasks(metadata, plannedTasks, createdTasks) {
    const nodeIdToTaskId = {};
    plannedTasks.forEach((task, index) => {
        if (task.symbolic_id && createdTasks[index]?.id) {
            nodeIdToTaskId[task.symbolic_id] = createdTasks[index].id;
        }
    });
    const taskHints = {};
    plannedTasks.forEach((task, index) => {
        const taskId = createdTasks[index]?.id;
        if (!taskId || !task.symbolic_id)
            return;
        const symbolicDeps = task.symbolic_depends_on ?? metadata.node_dependencies?.[task.symbolic_id] ?? [];
        taskHints[taskId] = {
            node_id: task.symbolic_id,
            lane: task.lane,
            filePaths: task.filePaths,
            domains: task.domains,
            depends_on: symbolicDeps.map((dep) => nodeIdToTaskId[dep]).filter(Boolean),
            symbolic_depends_on: symbolicDeps,
            allocation_reason: task.allocation_reason ?? metadata.allocation_reasons[task.symbolic_id],
        };
    });
    return {
        ...metadata,
        node_id_to_task_id: nodeIdToTaskId,
        task_hints: taskHints,
    };
}
export function buildRepoAwareTeamExecutionPlan(input) {
    const resolution = input.allowDagHandoff === true
        ? readTeamDagHandoffForLatestPlan(input.cwd)
        : { dag: null, source: 'none', error: 'dag_handoff_not_approved_for_invocation' };
    if (resolution.dag)
        return buildFromDag(input, resolution);
    const legacy = input.buildLegacyPlan(input.task, input.workerCount, input.agentType, input.explicitAgentType, input.explicitWorkerCount);
    return {
        ...legacy,
        metadata: {
            decomposition_source: 'legacy_text',
            dag_artifact_path: resolution.path,
            fallback_reason: resolution.error ?? 'no_valid_dag',
            worker_count_requested: input.workerCount,
            worker_count_effective: legacy.workerCount,
            worker_count_source: input.explicitWorkerCount ? 'cli-explicit' : 'default-derived',
            ready_lane_count: legacy.workerCount,
            useful_lane_count: legacy.workerCount,
            allocation_reasons: {},
            ...(input.approvedRepositoryContextSummary ? { approved_context_summary: input.approvedRepositoryContextSummary } : {}),
        },
    };
}
//# sourceMappingURL=repo-aware-decomposition.js.map