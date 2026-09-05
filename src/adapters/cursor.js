import os from 'node:os';
import path from 'node:path';
import {
  contentToText,
  parseJsonLines,
  readPreview,
  safelyStat,
  walkLogFiles,
} from './utils.js';

const CURSOR_DIRECTORY = path.join(os.homedir(), '.cursor');

function mightBelongToProject(filePath, projectDir) {
  const preview = readPreview(filePath);
  if (!preview) return false;
  return preview.includes(projectDir);
}

export function find(projectDir = process.cwd()) {
  try {
    return walkLogFiles(CURSOR_DIRECTORY, 2000)
      .filter((filePath) => mightBelongToProject(filePath, projectDir))
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
      const role = record?.role ?? record?.message?.role ?? record?.type;
      const text = contentToText(record?.message?.content ?? record?.content ?? record?.text);
      return /^(user|assistant)$/i.test(role ?? '') && text
        ? [{ role: role.toLowerCase(), text, timestamp: record.timestamp ?? null }]
        : [];
    });
    return { events, filePath };
  } catch {
    return null;
  }
}

export default {
  name: 'Cursor',
  experimental: true,
  find,
  parse,
};
