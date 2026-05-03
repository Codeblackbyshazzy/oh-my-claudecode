import { afterEach, describe, expect, it } from 'vitest';
import { synthesizeDelegationPlan } from '../delegation-policy.js';
describe('delegation-policy OMX parity surface', () => {
    const saved = { OMC_TEAM_CHILD_MODEL: process.env.OMC_TEAM_CHILD_MODEL, OMX_TEAM_CHILD_MODEL: process.env.OMX_TEAM_CHILD_MODEL };
    afterEach(() => {
        if (saved.OMC_TEAM_CHILD_MODEL === undefined)
            delete process.env.OMC_TEAM_CHILD_MODEL;
        else
            process.env.OMC_TEAM_CHILD_MODEL = saved.OMC_TEAM_CHILD_MODEL;
        if (saved.OMX_TEAM_CHILD_MODEL === undefined)
            delete process.env.OMX_TEAM_CHILD_MODEL;
        else
            process.env.OMX_TEAM_CHILD_MODEL = saved.OMX_TEAM_CHILD_MODEL;
    });
    it('disables delegation for narrow typo/copy tasks', () => {
        expect(synthesizeDelegationPlan({
            subject: 'Fix typo',
            description: 'Fix typo in a single file',
            role: 'writer',
        })).toEqual({ mode: 'none' });
    });
    it('requires auto delegation probes for broad investigative work', () => {
        process.env.OMC_TEAM_CHILD_MODEL = 'child-model';
        const plan = synthesizeDelegationPlan({
            subject: 'Debug repo-wide regression',
            description: 'Investigate flaky test coverage and map references',
            role: 'debugger',
        });
        expect(plan.mode).toBe('auto');
        expect(plan.max_parallel_subtasks).toBe(3);
        expect(plan.child_model).toBe('child-model');
        expect(plan.subtask_candidates).toEqual(expect.arrayContaining([
            expect.stringContaining('Debug/root-cause probe'),
            expect.stringContaining('Repository map probe'),
            expect.stringContaining('Test probe'),
        ]));
    });
    it('uses optional delegation for ordinary scoped work', () => {
        const plan = synthesizeDelegationPlan({
            subject: 'Add helper',
            description: 'Add a helper for task status formatting',
            role: 'executor',
        });
        expect(plan.mode).toBe('optional');
        expect(plan.max_parallel_subtasks).toBe(2);
    });
});
//# sourceMappingURL=delegation-policy.test.js.map