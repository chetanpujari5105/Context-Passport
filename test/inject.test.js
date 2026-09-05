import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { END_MARKER, injectHandoff, START_MARKER } from '../src/inject.js';

test('inject replaces an existing Context Passport block instead of duplicating it', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'context-passport-test-'));
  const agentsPath = path.join(temporaryDirectory, 'AGENTS.md');
  fs.writeFileSync(agentsPath, '# Project Rules\nKeep this introduction.\n', 'utf8');

  try {
    injectHandoff('# Old handoff\nOld details', temporaryDirectory);
    injectHandoff('# New handoff\nNew details', temporaryDirectory);
    const contents = fs.readFileSync(agentsPath, 'utf8');

    assert.equal(contents.split(START_MARKER).length - 1, 1);
    assert.equal(contents.split(END_MARKER).length - 1, 1);
    assert.match(contents, /# New handoff/);
    assert.doesNotMatch(contents, /# Old handoff/);
    assert.match(contents, /Keep this introduction\./);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
