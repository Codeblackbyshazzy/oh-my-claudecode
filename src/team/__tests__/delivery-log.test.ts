import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  appendTeamDeliveryLog,
  appendTeamDeliveryLogForCwd,
  teamDeliveryLogPath,
} from '../delivery-log.js';

describe('delivery-log OMX parity adapter', () => {
  it('builds dated team delivery log paths', () => {
    expect(teamDeliveryLogPath('/tmp/logs', new Date('2026-05-02T12:00:00.000Z')))
      .toBe('/tmp/logs/team-delivery-2026-05-02.jsonl');
  });

  it('writes compact JSONL entries and normalizes transport names', async () => {
    const root = await mkdtemp(join(tmpdir(), 'omc-team-delivery-log-'));
    try {
      const logsDir = join(root, 'logs');
      await appendTeamDeliveryLog(logsDir, {
        event: 'dispatch_result',
        source: 'test',
        team: 'demo',
        transport: 'tmux_send_keys',
        result: 'sent',
        omitted: undefined,
      });

      const logText = await readFile(teamDeliveryLogPath(logsDir), 'utf-8');
      const entry = JSON.parse(logText.trim()) as Record<string, unknown>;
      expect(entry.kind).toBe('team_delivery');
      expect(entry.transport).toBe('send-keys');
      expect(entry.omitted).toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('writes cwd-scoped OMC logs under .omc/logs', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'omc-team-delivery-cwd-'));
    try {
      await appendTeamDeliveryLogForCwd(cwd, {
        event: 'mailbox_created',
        source: 'test',
        team: 'demo',
        transport: 'prompt_stdin',
        result: 'created',
      });
      const logText = await readFile(teamDeliveryLogPath(join(cwd, '.omc', 'logs')), 'utf-8');
      const entry = JSON.parse(logText.trim()) as Record<string, unknown>;
      expect(entry.transport).toBe('prompt-stdin');
      expect(entry.event).toBe('mailbox_created');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
