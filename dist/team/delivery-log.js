import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
function normalizeTransport(transport) {
    if (typeof transport !== 'string')
        return undefined;
    switch (transport) {
        case 'tmux_send_keys':
            return 'send-keys';
        case 'prompt_stdin':
            return 'prompt-stdin';
        default:
            return transport;
    }
}
function compactObject(value) {
    return Object.fromEntries(Object.entries(value).filter(([, candidate]) => candidate !== undefined));
}
export function teamDeliveryLogPath(logsDir, now = new Date()) {
    return join(logsDir, `team-delivery-${now.toISOString().slice(0, 10)}.jsonl`);
}
export async function appendTeamDeliveryLog(logsDir, event) {
    const now = new Date();
    const entry = compactObject({
        timestamp: now.toISOString(),
        kind: 'team_delivery',
        ...event,
        transport: normalizeTransport(event.transport),
    });
    await mkdir(logsDir, { recursive: true }).catch(() => { });
    await appendFile(teamDeliveryLogPath(logsDir, now), `${JSON.stringify(entry)}\n`).catch(() => { });
}
export async function appendTeamDeliveryLogForCwd(cwd, event) {
    await appendTeamDeliveryLog(join(cwd, '.omc', 'logs'), event);
}
//# sourceMappingURL=delivery-log.js.map