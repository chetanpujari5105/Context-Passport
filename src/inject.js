import fs from 'node:fs';
import path from 'node:path';

export const START_MARKER = '<!-- CONTEXT PASSPORT START -->';
export const END_MARKER = '<!-- CONTEXT PASSPORT END -->';

function chooseTarget(cwd) {
  const agents = path.join(cwd, 'AGENTS.md');
  if (fs.existsSync(agents)) return agents;
  const claude = path.join(cwd, 'CLAUDE.md');
  return fs.existsSync(claude) ? claude : agents;
}

export function injectHandoff(content, cwd = process.cwd()) {
  const targetPath = chooseTarget(cwd);
  const existing = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : '';
  const block = `${START_MARKER}\n${String(content).trim()}\n${END_MARKER}`;
  const completeBlock = /<!-- CONTEXT PASSPORT START -->[\s\S]*?<!-- CONTEXT PASSPORT END -->/;
  const unterminatedBlock = /<!-- CONTEXT PASSPORT START -->[\s\S]*$/;

  let updated;
  if (completeBlock.test(existing)) {
    updated = existing.replace(completeBlock, block);
  } else if (unterminatedBlock.test(existing)) {
    updated = existing.replace(unterminatedBlock, block);
  } else {
    updated = `${existing.trimEnd()}${existing.trim() ? '\n\n' : ''}${block}`;
  }

  fs.writeFileSync(targetPath, `${updated.trimEnd()}\n`, 'utf8');
  return targetPath;
}
