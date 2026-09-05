import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse as parseCodex } from '../src/adapters/codex.js';
import { getGoal, getLastError, getNextStep, truncateStatLines } from '../src/extract.js';

test('filesTouched truncates to 15 lines with the correct suffix', () => {
  const stat = Array.from({ length: 17 }, (_, index) => ` file-${index + 1}.js | 1 +`).join('\n');
  const output = truncateStatLines(stat);
  const lines = output.split('\n');

  assert.equal(lines.length, 15);
  assert.equal(lines[0], ' file-1.js | 1 +');
  assert.equal(lines[13], ' file-14.js | 1 +');
  assert.equal(lines[14], '+3 more');
});

test('Codex adapter parse handles missing and malformed log files without throwing', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'context-passport-test-'));
  const missingPath = path.join(temporaryDirectory, 'missing.jsonl');
  const malformedPath = path.join(temporaryDirectory, 'malformed.jsonl');
  fs.writeFileSync(malformedPath, '{this is not valid JSON\n', 'utf8');

  try {
    assert.doesNotThrow(() => parseCodex(missingPath));
    assert.equal(parseCodex(missingPath), null);
    assert.doesNotThrow(() => parseCodex(malformedPath));
    assert.equal(parseCodex(malformedPath), null);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('goal extraction removes a platform plugin catalog while retaining the user request', () => {
  const goal = getGoal([
    {
      role: 'user',
      text: '<recommended_plugins>catalog contents</recommended_plugins>\n# AGENTS.md instructions for project',
    },
    {
      role: 'user',
      text: '<recommended_plugins>catalog contents</recommended_plugins>\nBuild Context Passport and run its tests.',
    },
  ]);

  assert.equal(goal, 'Build Context Passport and run its tests.');
});

test('lastError ignores user instructions and retains a real tool error', () => {
  const error = getLastError([
    { role: 'user', text: 'If git push fails, explain the authentication blocker.' },
    { role: 'tool', kind: 'tool-output', text: 'npm error code ENOTFOUND' },
  ]);

  assert.equal(error, 'npm error code ENOTFOUND');
});

test('lastError reads a real error from a structured tool result', () => {
  const error = getLastError([
    { role: 'tool', kind: 'tool-output', text: JSON.stringify({ output: 'fatal: Authentication failed' }) },
  ]);

  assert.equal(error, 'fatal: Authentication failed');
});

test('nextStep ignores code comments that happen to contain the words next step', () => {
  const nextStep = getNextStep([
    { role: 'developer', kind: 'message', text: 'Follow-up instructions for the platform.' },
    { role: 'assistant', kind: 'message', text: 'getNextStep(events) // reverse-search TODO/question, else final message' },
    { role: 'assistant', kind: 'message', text: 'Release-ready implementation complete.' },
  ]);

  assert.equal(nextStep, 'Release-ready implementation complete.');
});
