import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildRepoAwareTeamExecutionPlan } from '../repo-aware-decomposition.js';
function repo() {
    const cwd = mkdtempSync(join(tmpdir(), 'omc-dag-'));
    mkdirSync(join(cwd, '.omc', 'plans'), { recursive: true });
    mkdirSync(join(cwd, 'src', 'team'), { recursive: true });
    writeFileSync(join(cwd, 'src', 'team', 'runtime.ts'), '');
    writeFileSync(join(cwd, '.omc', 'plans', 'prd-demo.md'), '# Demo\n');
    writeFileSync(join(cwd, '.omc', 'plans', 'test-spec-demo.md'), '# Tests\n');
    return cwd;
}
function withRepo(fn) {
    const cwd = repo();
    try {
        return fn(cwd);
    }
    finally {
        rmSync(cwd, { recursive: true, force: true });
    }
}
const legacy = () => ({
    workerCount: 3,
    tasks: [{ subject: 'legacy', description: 'legacy', owner: 'worker-1', role: 'team-executor' }],
});
describe('buildRepoAwareTeamExecutionPlan', () => {
    it('falls back to legacy text decomposition when no DAG exists', () => {
        withRepo((cwd) => {
            const plan = buildRepoAwareTeamExecutionPlan({
                task: 'fix tests', workerCount: 3, agentType: 'executor', explicitAgentType: false, explicitWorkerCount: false, cwd, buildLegacyPlan: legacy,
            });
            expect(plan.metadata?.decomposition_source).toBe('legacy_text');
            expect(plan.tasks[0].subject).toBe('legacy');
        });
    });
    it('imports DAG sidecar, reduces implicit worker count, and preserves symbolic dependencies for runtime remap', () => {
        withRepo((cwd) => {
            writeFileSync(join(cwd, '.omc', 'plans', 'team-dag-demo.json'), JSON.stringify({
                schema_version: 1,
                nodes: [
                    { id: 'impl', lane: 'implementation', role: 'executor', subject: 'Implement runtime', description: 'Change runtime', filePaths: ['src/team/runtime.ts'], requires_code_change: true },
                    { id: 'tests', lane: 'verification', role: 'test-engineer', subject: 'Test runtime', description: 'Cover runtime', depends_on: ['impl'] },
                ],
                worker_policy: { requested_count: 3, count_source: 'plan-suggested' },
            }));
            const plan = buildRepoAwareTeamExecutionPlan({
                task: 'team', workerCount: 3, agentType: 'executor', explicitAgentType: false, explicitWorkerCount: false, cwd, buildLegacyPlan: legacy, allowDagHandoff: true,
            });
            expect(plan.metadata?.decomposition_source).toBe('dag_sidecar');
            expect(plan.workerCount).toBe(2);
            expect(plan.tasks).toHaveLength(2);
            expect(plan.tasks[1].blocked_by).toBeUndefined();
            expect(plan.tasks[1].depends_on).toBeUndefined();
            expect(plan.tasks[1].symbolic_depends_on).toEqual(['impl']);
            expect(plan.metadata?.node_id_to_task_id).toBeUndefined();
            expect(plan.metadata?.node_dependencies?.tests).toEqual(['impl']);
            expect(plan.tasks[0].description).toMatch(/File scope: src\/team\/runtime.ts/);
        });
    });
    it('does not import a stale DAG sidecar unless the approved launch gate opts in', () => {
        withRepo((cwd) => {
            writeFileSync(join(cwd, '.omc', 'plans', 'team-dag-demo.json'), JSON.stringify({
                schema_version: 1,
                nodes: [{ id: 'stale', subject: 'Stale sidecar', description: 'Must not override normal startup' }],
            }));
            const plan = buildRepoAwareTeamExecutionPlan({
                task: 'fix unrelated tests', workerCount: 3, agentType: 'executor', explicitAgentType: false, explicitWorkerCount: false, cwd, buildLegacyPlan: legacy,
            });
            expect(plan.metadata?.decomposition_source).toBe('legacy_text');
            expect(plan.metadata?.fallback_reason).toBe('dag_handoff_not_approved_for_invocation');
            expect(plan.tasks[0].subject).toBe('legacy');
        });
    });
    it('requires a matching approved test spec before importing an opted-in DAG sidecar', () => {
        withRepo((cwd) => {
            writeFileSync(join(cwd, '.omc', 'plans', 'test-spec-other.md'), '# Other tests\n');
            writeFileSync(join(cwd, '.omc', 'plans', 'team-dag-demo.json'), JSON.stringify({
                schema_version: 1,
                nodes: [{ id: 'impl', subject: 'Implement', description: 'Implement from DAG' }],
            }));
            unlinkSync(join(cwd, '.omc', 'plans', 'test-spec-demo.md'));
            const plan = buildRepoAwareTeamExecutionPlan({
                task: 'team', workerCount: 3, agentType: 'executor', explicitAgentType: false, explicitWorkerCount: false, cwd, buildLegacyPlan: legacy, allowDagHandoff: true,
            });
            expect(plan.metadata?.decomposition_source).toBe('legacy_text');
            expect(plan.metadata?.fallback_reason).toBe('missing_matching_test_spec');
            expect(plan.tasks[0].subject).toBe('legacy');
        });
    });
    it('carries approved repository context summary only when the launch gate supplies it', () => {
        withRepo((cwd) => {
            writeFileSync(join(cwd, '.omc', 'plans', 'team-dag-demo.json'), JSON.stringify({
                schema_version: 1,
                nodes: [{ id: 'impl', subject: 'Implement', description: 'Implement from DAG' }],
            }));
            const plan = buildRepoAwareTeamExecutionPlan({
                task: 'team',
                workerCount: 3,
                agentType: 'executor',
                explicitAgentType: false,
                explicitWorkerCount: false,
                cwd,
                buildLegacyPlan: legacy,
                allowDagHandoff: true,
                approvedRepositoryContextSummary: {
                    sourcePath: join(cwd, '.omc', 'plans', 'repo-context-demo.md'),
                    content: 'Approved context: runtime lives in src/team/runtime.ts',
                    truncated: false,
                },
            });
            expect(plan.metadata?.approved_context_summary?.content).toBe('Approved context: runtime lives in src/team/runtime.ts');
        });
    });
    it('does not consume ambient repository context summary without an approved launch match', () => {
        withRepo((cwd) => {
            writeFileSync(join(cwd, '.omc', 'plans', 'team-dag-demo.json'), JSON.stringify({
                schema_version: 1,
                nodes: [{ id: 'stale', subject: 'Stale', description: 'Stale DAG' }],
            }));
            const plan = buildRepoAwareTeamExecutionPlan({
                task: 'fix unrelated tests',
                workerCount: 3,
                agentType: 'executor',
                explicitAgentType: false,
                explicitWorkerCount: false,
                cwd,
                buildLegacyPlan: legacy,
            });
            expect(plan.metadata?.approved_context_summary).toBeUndefined();
            expect(plan.metadata?.fallback_reason).toBe('dag_handoff_not_approved_for_invocation');
        });
    });
    it('honors CLI-explicit worker count beyond ready lanes', () => {
        withRepo((cwd) => {
            writeFileSync(join(cwd, '.omc', 'plans', 'team-dag-demo.json'), JSON.stringify({
                schema_version: 1,
                nodes: [{ id: 'impl', subject: 'Implement one lane', description: 'Do it' }],
                worker_policy: { requested_count: 1, count_source: 'plan-suggested' },
            }));
            const plan = buildRepoAwareTeamExecutionPlan({
                task: 'team', workerCount: 4, agentType: 'executor', explicitAgentType: true, explicitWorkerCount: true, cwd, buildLegacyPlan: legacy, allowDagHandoff: true,
            });
            expect(plan.workerCount).toBe(4);
            expect(plan.metadata?.worker_count_source).toBe('cli-explicit');
        });
    });
});
//# sourceMappingURL=repo-aware-decomposition.test.js.map