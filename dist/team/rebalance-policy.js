import { chooseTaskOwner } from './allocation-policy.js';
function hasCompletedDependencies(task, taskById) {
    const dependencyIds = task.depends_on ?? task.blocked_by ?? [];
    if (dependencyIds.length === 0)
        return true;
    return dependencyIds.every((id) => taskById.get(id)?.status === 'completed');
}
function isWorkerAvailable(worker) {
    return worker.alive && (worker.status.state === 'idle' || worker.status.state === 'done' || worker.status.state === 'unknown');
}
export function buildRebalanceDecisions(input) {
    const taskById = new Map(input.tasks.map((task) => [task.id, task]));
    const liveWorkers = input.workers.filter(isWorkerAvailable);
    if (liveWorkers.length === 0)
        return [];
    const unownedPendingTasks = input.tasks
        .filter((task) => task.status === 'pending' && !task.owner)
        .filter((task) => hasCompletedDependencies(task, taskById))
        .sort((left, right) => {
        const leftReclaimed = input.reclaimedTaskIds.includes(left.id) ? 0 : 1;
        const rightReclaimed = input.reclaimedTaskIds.includes(right.id) ? 0 : 1;
        if (leftReclaimed !== rightReclaimed)
            return leftReclaimed - rightReclaimed;
        return Number(left.id) - Number(right.id);
    });
    const inFlightAssignments = input.tasks
        .filter((task) => task.owner && task.status === 'in_progress')
        .map((task) => ({ owner: task.owner, role: task.role }));
    const decisions = [];
    const claimedTaskIds = new Set();
    for (const task of unownedPendingTasks) {
        if (claimedTaskIds.has(task.id))
            continue;
        const decision = chooseTaskOwner(task, liveWorkers, inFlightAssignments);
        decisions.push({
            type: 'assign',
            taskId: task.id,
            workerName: decision.owner,
            reason: input.reclaimedTaskIds.includes(task.id)
                ? `reclaimed work is ready; ${decision.reason}`
                : `idle worker pickup; ${decision.reason}`,
        });
        inFlightAssignments.push({ owner: decision.owner, role: task.role });
        claimedTaskIds.add(task.id);
    }
    return decisions;
}
//# sourceMappingURL=rebalance-policy.js.map