import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  contentToText,
  parseJsonLines,
  pathsMatch,
  readPreview,
  safelyStat,
  walkLogFiles,
} from './utils.js';

const PROJECTS_DIRECTORY = path.join(os.homedir(), '.claude', 'projects');

function encodedProjectDirectory(projectDir) {
  return projectDir.replace(/[\\/]/g, '-');
}

function hasProjectPath(filePath, projectDir) {
  const preview = readPreview(filePath);
  if (!preview) return false;
  for (const line of preview.split(/\r?\n/)) {
    try {
      if (pathsMatch(JSON.parse(line)?.cwd, projectDir)) return true;
    } catch {
      // A bad line should not prevent discovery of a valid session.
    }
  }
  return false;
}

export function find(projectDir = process.cwd()) {
  try {
    const encodedDirectory = path.join(PROJECTS_DIRECTORY, encodedProjectDirectory(projectDir));
    const roots = fs.existsSync(encodedDirectory) ? [encodedDirectory] : [PROJECTS_DIRECTORY];
    return roots
      .flatMap((root) => walkLogFiles(root))
      .filter((filePath) => hasProjectPath(filePath, projectDir))
      .map((filePath) => ({ filePath, stat: safelyStat(filePath) }))
      .sort((left, right) => (right.stat?.mtimeMs ?? 0) - (left.stat?.mtimeMs ?? 0))[0]?.filePath ?? null;
  } catch {
    return null;
  }
}

export function parse(filePath) {
  try {
    const records = parseJsonLines(filePath);
    if (!records?.length) return null;

    const events = records.flatMap((record) => {
      const role = record?.message?.role ?? (record?.type === 'user' || record?.type === 'assistant' ? record.type : null);
      const text = contentToText(record?.message?.content ?? record?.message ?? record?.content);
      return role && text ? [{ role, text, timestamp: record.timestamp ?? null }] : [];
    });
    return { events, filePath };
  } catch {
    return null;
  }
}

export default {
  name: 'Claude Code',
  experimental: false,
  find,
  parse,
};
