import codex from './codex.js';
import claude from './claude.js';
import cursor from './cursor.js';
import { safelyStat } from './utils.js';

export const adapters = [codex, claude, cursor];

export function getAdapter(name) {
  const normalized = String(name ?? '').trim().toLowerCase();
  return adapters.find((adapter) => {
    const adapterName = adapter.name.toLowerCase();
    return adapterName === normalized
      || adapterName.replace(/\s+code$/, '') === normalized
      || (normalized === 'claude-code' && adapterName === 'claude code');
  }) ?? null;
}

export function detectAdapter(projectDir, forcedTool) {
  const candidates = forcedTool ? [getAdapter(forcedTool)].filter(Boolean) : adapters;
  const matches = candidates
    .map((adapter) => {
      const filePath = adapter.find(projectDir);
      if (!filePath) return null;
      return { adapter, filePath };
    })
    .filter(Boolean);

  if (forcedTool) {
    return matches[0] ?? { adapter: candidates[0] ?? null, filePath: null };
  }

  return matches
    .map((match) => ({ ...match, modifiedAt: safeMtime(match.filePath) }))
    .sort((left, right) => right.modifiedAt - left.modifiedAt)[0] ?? { adapter: null, filePath: null };
}

function safeMtime(filePath) {
  return safelyStat(filePath)?.mtimeMs ?? 0;
}
