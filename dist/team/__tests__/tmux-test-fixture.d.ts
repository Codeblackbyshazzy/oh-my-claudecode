export interface TempTmuxSessionFixture {
    sessionName: string;
    serverName: string;
    windowTarget: string;
    leaderPaneId: string;
    socketPath: string;
    serverKind: 'ambient' | 'synthetic';
    env: {
        TMUX: string;
        TMUX_PANE: string;
    };
    sessionExists: (targetSessionName?: string) => boolean;
}
export interface TempTmuxSessionOptions {
    useAmbientServer?: boolean;
}
export declare function isRealTmuxAvailable(): boolean;
export declare function tmuxSessionExists(sessionName: string, serverName?: string): boolean;
export declare function withTempTmuxSession<T>(optionsOrFn: TempTmuxSessionOptions | ((fixture: TempTmuxSessionFixture) => Promise<T> | T), maybeFn?: (fixture: TempTmuxSessionFixture) => Promise<T> | T): Promise<T>;
//# sourceMappingURL=tmux-test-fixture.d.ts.map