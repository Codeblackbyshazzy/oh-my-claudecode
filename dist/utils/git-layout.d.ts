export interface GitLayout {
    gitDir: string;
    commonDir: string;
    worktreeRoot: string;
}
export declare function findGitLayout(startCwd: string): GitLayout | null;
export declare function readGitLayoutFile(baseDir: string, ...parts: string[]): string | null;
//# sourceMappingURL=git-layout.d.ts.map