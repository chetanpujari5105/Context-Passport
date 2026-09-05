import fs from 'node:fs';
import path from 'node:path';

const LOG_EXTENSIONS = new Set(['.jsonl', '.json', '.log']);

export function normalizeProjectPath(value) {
  if (!value || typeof value !== 'string') return '';
  try {
    return path.resolve(value).replace(/[\\/]+$/, '');
  } catch {
    return value.replace(/[\\/]+$/, '');
  }
}

export function pathsMatch(left, right) {
  const normalizedLeft = normalizeProjectPath(left);
  const normalizedRight = normalizeProjectPath(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

export function safelyStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

export function walkLogFiles(rootDir, maxFiles = 5000) {
  const files = [];
  const pending = [rootDir];

  while (pending.length && files.length < maxFiles) {
    const directory = pending.pop();
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (entry.isFile() && LOG_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(entryPath);
        if (files.length >= maxFiles) break;
      }
    }
  }

  return files;
}

export function readText(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

export function readPreview(filePath, maxBytes = 256 * 1024) {
  let descriptor;
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    const buffer = Buffer.alloc(Math.min(stat.size, maxBytes));
    descriptor = fs.openSync(filePath, 'r');
    fs.readSync(descriptor, buffer, 0, buffer.length, 0);
    return buffer.toString('utf8');
  } catch {
    return null;
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // A failed close should not make an adapter fail.
      }
    }
  }
}

export function parseJsonLines(filePath) {
  const contents = readText(filePath);
  if (contents === null) return null;

  const records = [];
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch {
      // Session logs can end with a partially written line. Ignore just that line.
    }
  }
  return records;
}

export function contentToText(value, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => contentToText(item, depth + 1)).filter(Boolean).join('\n');
  }
  if (typeof value !== 'object') return '';

  if (typeof value.text === 'string') return value.text;
  if (typeof value.content === 'string') return value.content;
  if (typeof value.output_text === 'string') return value.output_text;
  if (typeof value.input_text === 'string') return value.input_text;
  if (typeof value.value === 'string') return value.value;

  const keys = ['content', 'message', 'output', 'input', 'result'];
  for (const key of keys) {
    if (value[key] !== undefined) {
      const text = contentToText(value[key], depth + 1);
      if (text) return text;
    }
  }
  return '';
}

export function newestFile(files) {
  return files
    .map((filePath) => ({ filePath, stat: safelyStat(filePath) }))
    .filter(({ stat }) => stat?.isFile())
    .sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)[0]?.filePath ?? null;
}

export function truncateText(value, maxLength) {
  const compact = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}
