import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface TeamRuntimeWorkerDescriptor {
  name: string;
  index?: number;
  role?: string;
  pane_id?: string;
}

export interface TeamRuntimeDescriptor {
  workers?: TeamRuntimeWorkerDescriptor[];
  tmux_session?: string;
  leader_pane_id?: string;
  [key: string]: unknown;
}

/**
 * Read the OMC team runtime descriptor from its canonical manifest path first,
 * with compatibility fallbacks for older OMX-derived/runtime-v2 files.
 */
export async function readTeamRuntimeDescriptor(teamDir: string): Promise<TeamRuntimeDescriptor | null> {
  for (const filename of ['manifest.json', 'manifest.v2.json', 'config.json']) {
    const descriptorPath = join(teamDir, filename);
    if (!existsSync(descriptorPath)) continue;
    try {
      const raw = await readFile(descriptorPath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') return parsed as TeamRuntimeDescriptor;
    } catch {
      // Try the next compatibility source.
    }
  }
  return null;
}
