import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_RENDERED_CHARS, renderHandoff } from '../src/render.js';

test('render omits empty sections', () => {
  const markdown = renderHandoff({
    goal: 'Ship the handoff utility.',
    decisionsLocked: [],
    filesTouched: '',
    currentState: '',
    lastError: null,
    nextStep: '',
  }, {
    sourceTool: 'Codex',
    now: new Date('2026-01-01T00:00:00.000Z'),
  });

  assert.match(markdown, /## Goal\nShip the handoff utility\./);
  assert.doesNotMatch(markdown, /## Decisions Locked/);
  assert.doesNotMatch(markdown, /## Files Touched/);
  assert.doesNotMatch(markdown, /## Current State/);
  assert.doesNotMatch(markdown, /## Next Step/);
});

test('render enforces the 3000-character cap with an ellipsis', () => {
  const markdown = renderHandoff({
    goal: 'A'.repeat(5000),
    decisionsLocked: [],
    filesTouched: '',
    currentState: '',
    lastError: null,
    nextStep: '',
  });

  assert.ok(markdown.length <= MAX_RENDERED_CHARS);
  assert.match(markdown, /\n\.\.\.\n/);
  assert.match(markdown, /Paste this into your new AI account\/session/);
});
