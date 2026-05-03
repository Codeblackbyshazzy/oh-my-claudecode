const FILE_PATH_PATTERN = /(?:^|[\s("'])((?:src|scripts|docs|prompts|skills|templates|native|crates)\/[A-Za-z0-9._/-]+)/g;
const DOMAIN_STOP_WORDS = new Set([
    'a', 'an', 'and', 'the', 'for', 'with', 'into', 'from', 'then', 'than', 'that', 'this', 'those', 'these',
    'work', 'task', 'tasks', 'implement', 'implementation', 'continue', 'additional', 'update', 'fix', 'lane',
    'runtime', 'tests', 'test', 'worker', 'workers', 'leader', 'team', 'plan', 'approved', 'supporting',
    'needed', 'focus', 'prefer', 'plus', 'related', 'files', 'file', 'code', 'notify', 'description',
    'src', 'scripts', 'docs', 'prompts', 'skills', 'templates', 'native', 'crates', 'team', 'index', 'test', 'spec',
]);
function normalizeHint(value) {
    const normalized = value.trim().toLowerCase();
    return normalized.length >= 3 ? normalized : null;
}
function collectPathHints(pathValue, target) {
    const normalizedPath = normalizeHint(pathValue.replace(/^[./]+/, ''));
    if (!normalizedPath)
        return;
    target.add(`path:${normalizedPath}`);
    const basename = normalizedPath.split('/').pop() ?? normalizedPath;
    const basenameStem = basename.replace(/\.[^.]+$/, '');
    const normalizedStem = normalizeHint(basenameStem);
    if (normalizedStem)
        target.add(`domain:${normalizedStem}`);
}
function collectDomainHints(value, target) {
    const words = value.toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g) ?? [];
    for (const word of words) {
        if (!DOMAIN_STOP_WORDS.has(word))
            target.add(`domain:${word}`);
    }
}
function extractTaskHints(task) {
    const hints = new Set();
    for (const pathValue of task.filePaths ?? [])
        collectPathHints(pathValue, hints);
    for (const domain of task.domains ?? [])
        collectDomainHints(domain, hints);
    const text = `${task.subject}\n${task.description}`;
    for (const match of text.matchAll(FILE_PATH_PATTERN)) {
        if (match[1])
            collectPathHints(match[1], hints);
    }
    collectDomainHints(text, hints);
    return hints;
}
function countHintOverlap(taskHints, workerHints) {
    let overlap = 0;
    for (const hint of taskHints) {
        if (workerHints.has(hint))
            overlap += hint.startsWith('path:') ? 3 : 1;
    }
    return overlap;
}
function scoreWorker(task, worker, taskHints, uniformRolePool = false) {
    let score = 0;
    const taskRole = task.role?.trim();
    const workerRole = worker.role?.trim();
    if (!uniformRolePool) {
        if (taskRole && worker.primaryRole === taskRole)
            score += 18;
        if (taskRole && workerRole === taskRole)
            score += 12;
        if (taskRole && !worker.primaryRole && worker.assignedCount === 0)
            score += 9;
    }
    const overlap = countHintOverlap(taskHints, worker.scopeHints);
    if (overlap > 0)
        score += overlap * 4;
    if (taskHints.size > 0 && overlap === 0 && worker.scopeHints.size > 0)
        score -= 3;
    score -= worker.assignedCount * 4;
    if ((task.blocked_by?.length ?? 0) > 0) {
        score -= worker.assignedCount;
    }
    return score;
}
export function chooseTaskOwner(task, workers, currentAssignments) {
    if (workers.length === 0) {
        throw new Error('at least one worker is required for allocation');
    }
    const taskHints = extractTaskHints(task);
    const workerState = workers.map((worker) => {
        const assigned = currentAssignments.filter((item) => item.owner === worker.name);
        const primaryRole = assigned.find((item) => item.role)?.role;
        const scopeHints = new Set();
        for (const item of assigned) {
            const itemHints = extractTaskHints({
                subject: item.subject ?? '',
                description: item.description ?? '',
                role: item.role,
                filePaths: item.filePaths,
                domains: item.domains,
            });
            for (const hint of itemHints)
                scopeHints.add(hint);
        }
        return {
            ...worker,
            assignedCount: (worker.currentLoad ?? 0) + assigned.length,
            primaryRole,
            scopeHints,
        };
    });
    const uniformRolePool = Boolean(task.role?.trim())
        && workerState.length > 0
        && workerState.every((worker) => worker.role?.trim() === task.role?.trim());
    const ranked = workerState
        .map((worker, index) => ({
        worker,
        index,
        score: scoreWorker(task, worker, taskHints, uniformRolePool),
        overlap: countHintOverlap(taskHints, worker.scopeHints),
    }))
        .sort((left, right) => {
        if (right.score !== left.score)
            return right.score - left.score;
        if (right.overlap !== left.overlap)
            return right.overlap - left.overlap;
        if (left.worker.assignedCount !== right.worker.assignedCount) {
            return left.worker.assignedCount - right.worker.assignedCount;
        }
        return left.index - right.index;
    });
    const selected = ranked[0]?.worker ?? workerState[0];
    const selectedOverlap = ranked[0]?.overlap ?? 0;
    const reasons = [];
    if (task.role && selected.primaryRole === task.role)
        reasons.push(`keeps ${task.role} work grouped`);
    else if (task.role && selected.role === task.role)
        reasons.push(`matches worker role ${selected.role}`);
    else
        reasons.push('balances current load');
    if (selectedOverlap > 0)
        reasons.push('preserves low-overlap file/domain ownership');
    if ((task.blocked_by?.length ?? 0) > 0)
        reasons.push('keeps blocked work on a lighter lane');
    return {
        owner: selected.name,
        reason: reasons.join('; '),
    };
}
export function allocateTasksToWorkers(tasks, workers) {
    if (tasks.length === 0 || workers.length === 0)
        return [];
    const assignments = [];
    for (const task of tasks) {
        const decision = chooseTaskOwner(task, workers, assignments);
        const taskId = task.id ?? '';
        assignments.push({
            ...task,
            owner: decision.owner,
            allocation_reason: decision.reason,
            taskId,
            workerName: decision.owner,
            reason: decision.reason,
        });
    }
    return assignments;
}
//# sourceMappingURL=allocation-policy.js.map