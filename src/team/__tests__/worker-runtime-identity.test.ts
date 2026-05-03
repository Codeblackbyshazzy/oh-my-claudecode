import { describe, expect, it } from 'vitest';
import {
  isLowComplexityAgentType,
  resolveAgentDefaultModel,
  resolveAgentReasoningEffort,
  resolveWorkerLaunchExtraFlags,
} from '../model-contract.js';

describe('worker runtime identity contract', () => {
  it('keeps low-complexity launch defaults without changing the role lane', () => {
    const model = resolveAgentDefaultModel('explore');
    const reasoning = resolveAgentReasoningEffort('explore');

    expect(reasoning).toBe('low');
    expect(model).toBeTruthy();
    expect(resolveWorkerLaunchExtraFlags(
      { OMC_TEAM_WORKER_LAUNCH_ARGS: '--no-alt-screen' } as NodeJS.ProcessEnv,
      [],
      model,
      reasoning,
    )).toEqual(['--no-alt-screen', '-c', 'model_reasoning_effort="low"', '--model', model]);
  });

  it('classifies low-complexity aliases without rewriting the role', () => {
    expect(isLowComplexityAgentType('style-reviewer')).toBe(true);
    expect(isLowComplexityAgentType('explore-low')).toBe(true);
    expect(resolveAgentDefaultModel('explore')).toBe(resolveAgentDefaultModel('explore-low'));
    expect(resolveAgentReasoningEffort('explore')).toBe('low');
  });
});
