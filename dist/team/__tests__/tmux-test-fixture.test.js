import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { isRealTmuxAvailable, tmuxSessionExists, withTempTmuxSession } from './tmux-test-fixture.js';
function skipUnlessTmux() {
    if (!isRealTmuxAvailable()) {
        throw new Error('tmux unavailable');
    }
}
function runAmbientTmux(args) {
    return execFileSync('tmux', args, {
        encoding: 'utf-8',
        env: {
            ...process.env,
            TMUX: undefined,
            TMUX_PANE: undefined,
        },
    }).trim();
}
function ambientSessionExists(sessionName) {
    try {
        runAmbientTmux(['has-session', '-t', sessionName]);
        return true;
    }
    catch {
        return false;
    }
}
function uniqueAmbientSessionName() {
    return `omx-ambient-test-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
describe('withTempTmuxSession', () => {
    it.runIf(isRealTmuxAvailable())('provides isolated tmux env and cleans up on success', async () => {
        skipUnlessTmux();
        const ambientTmux = process.env.TMUX;
        const ambientTmuxPane = process.env.TMUX_PANE;
        let sessionName = '';
        let serverName = '';
        await withTempTmuxSession(async (fixture) => {
            sessionName = fixture.sessionName;
            serverName = fixture.serverName;
            assert.match(fixture.sessionName, /^omx-test-/);
            assert.equal(fixture.serverKind, 'synthetic');
            assert.match(fixture.serverName, /^omx-fixture-/);
            assert.equal(process.env.TMUX, fixture.env.TMUX);
            assert.equal(process.env.TMUX_PANE, fixture.leaderPaneId);
            assert.equal(fixture.sessionExists(), true);
            assert.equal(tmuxSessionExists(fixture.sessionName), false, 'fixture session must not be visible on the maintainer default tmux server');
            if (ambientTmux) {
                assert.notEqual(fixture.env.TMUX, ambientTmux, 'synthetic fixture must use a different tmux socket/env tuple than the ambient session');
            }
            if (ambientTmuxPane) {
                assert.equal(fixture.leaderPaneId.startsWith('%'), true, 'fixture should still expose a pane id even when pane ids are recycled across tmux servers');
            }
        });
        assert.equal(tmuxSessionExists(sessionName, serverName), false);
        assert.equal(process.env.TMUX, ambientTmux);
        assert.equal(process.env.TMUX_PANE, ambientTmuxPane);
    });
    it.runIf(isRealTmuxAvailable())('cleans up when the callback throws', async () => {
        skipUnlessTmux();
        let sessionName = '';
        let serverName = '';
        await assert.rejects(() => withTempTmuxSession(async (fixture) => {
            sessionName = fixture.sessionName;
            serverName = fixture.serverName;
            throw new Error('fixture boom');
        }), /fixture boom/);
        assert.equal(tmuxSessionExists(sessionName, serverName), false);
    });
    it.runIf(isRealTmuxAvailable())('keeps ambient default-server sessions untouched by default', async () => {
        skipUnlessTmux();
        const ambientSessionName = uniqueAmbientSessionName();
        const created = runAmbientTmux([
            'new-session',
            '-d',
            '-P',
            '-F',
            '#{session_name}',
            '-s',
            ambientSessionName,
            'sleep 300',
        ]);
        assert.equal(created, ambientSessionName);
        try {
            await withTempTmuxSession(async (fixture) => {
                assert.equal(fixture.serverKind, 'synthetic');
                assert.equal(fixture.sessionExists(ambientSessionName), false);
                assert.equal(ambientSessionExists(ambientSessionName), true);
            });
            assert.equal(ambientSessionExists(ambientSessionName), true);
        }
        finally {
            try {
                runAmbientTmux(['kill-session', '-t', ambientSessionName]);
            }
            catch {
                // Best-effort cleanup.
            }
        }
    });
    it.runIf(isRealTmuxAvailable())('only uses the ambient server when a test explicitly opts in', async () => {
        skipUnlessTmux();
        let sessionName = '';
        await withTempTmuxSession({ useAmbientServer: true }, async (fixture) => {
            sessionName = fixture.sessionName;
            assert.equal(fixture.serverKind, 'ambient');
            assert.equal(fixture.serverName, '');
            assert.equal(ambientSessionExists(fixture.sessionName), true);
            assert.equal(fixture.sessionExists(), true);
        });
        assert.equal(ambientSessionExists(sessionName), false);
    });
});
//# sourceMappingURL=tmux-test-fixture.test.js.map