import fs from 'node:fs';
import path from 'node:path';

export const MAX_RENDERED_CHARS = 3000;

function section(title, content) {
  return content ? `## ${title}\n${content}` : '';
}

export function renderHandoff(passport, { sourceTool = 'No session log found', now = new Date() } = {}) {
  const decisions = passport.decisionsLocked?.length
    ? passport.decisionsLocked.map((decision) => `- ${decision}`).join('\n')
    : '';
  const currentState = [
    passport.currentState,
    passport.lastError ? `⚠️ Last error: ${passport.lastError}` : '',
  ].filter(Boolean).join('\n');

  const footer = '---\nPaste this into your new AI account/session as your first message before continuing.';
  const parts = [
    '# Context Passport Handoff',
    `Generated: ${now.toISOString()}`,
    `Source tool: ${sourceTool}`,
    section('Goal', passport.goal),
    section('Decisions Locked', decisions),
    section('Files Touched', passport.filesTouched),
    section('Current State', currentState),
    section('Next Step', passport.nextStep),
  ].filter(Boolean);

  const body = parts.join('\n\n');
  const rendered = `${body}\n\n${footer}\n`;
  if (rendered.length <= MAX_RENDERED_CHARS) return rendered;

  const suffix = `\n\n...\n\n${footer}\n`;
  return `${body.slice(0, MAX_RENDERED_CHARS - suffix.length).trimEnd()}${suffix}`;
}

export function writeHandoff(markdown, cwd = process.cwd()) {
  const outputPath = path.join(cwd, 'handoff.md');
  fs.writeFileSync(outputPath, markdown, 'utf8');
  return outputPath;
}
