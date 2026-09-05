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

const SESSIONS_DIRECTORY = path.join(os.homedir(), '.codex', 'sessions');

function summarizeToolCall(name, argumentsValue) {
  try {
    const parsed = typeof argumentsValue === 'string' ? JSON.parse(argumentsValue) : argumentsValue;
    const command = parsed?.cmd ?? parsed?.command;
    if (typeof command === 'string') return `${name}: ${command}`;
  } catch {
    // A tool's arguments do not need to be valid JSON to preserve the action.
  }
  const embeddedCommand = String(argumentsValue ?? '').match(/["']cmd["']\s*:\s*["']([^"']+)/)?.[1];
  if (embeddedCommand) return `${name}: ${embeddedCommand}`;
  return `${name} executed`;
}

function hasProjectMetadata(filePath, projectDir) {
  const preview = readPreview(filePath);
  if (!preview) return false;

  for (const line of preview.split(/\r?\n/)) {
    try {
      const record = JSON.parse(line);
      const payload = record?.payload ?? {};
      if (record?.type === 'session_meta' && pathsMatch(payload.cwd, projectDir)) return true;
      if (record?.type === 'turn_context' && pathsMatch(payload.cwd, projectDir)) return true;
    } catch {
      // Ignore malformed records while checking candidates.
    }
  }
  return false;
}

export function find(projectDir = process.cwd()) {
  try {
    return walkLogFiles(SESSIONS_DIRECTORY)
      .filter((filePath) => hasProjectMetadata(filePath, projectDir))
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

    const events = [];
    for (const record of records) {
      const payload = record?.payload ?? {};
      const timestamp = record?.timestamp ?? payload.timestamp ?? null;

      if (record?.type === 'response_item') {
        if (payload.type === 'message') {
          const text = contentToText(payload.content);
          if (text) events.push({ role: payload.role ?? 'unknown', text, timestamp, kind: 'message' });
        } else if (payload.type === 'agent_message') {
          const text = contentToText(payload.content);
          if (text) events.push({ role: 'assistant', text, timestamp, kind: 'message' });
        } else if (payload.type === 'function_call' || payload.type === 'custom_tool_call') {
          const name = payload.name ?? payload.call_id ?? 'tool call';
          const argumentsText = contentToText(payload.arguments ?? payload.input);
          events.push({
            role: 'assistant',
            text: summarizeToolCall(name, argumentsText),
            timestamp,
            kind: 'action',
          });
        } else if (payload.type === 'function_call_output' || payload.type === 'custom_tool_call_output') {
          const text = contentToText(payload.output ?? payload.content);
          if (text) events.push({ role: 'tool', text, timestamp, kind: 'tool-output' });
        }
        continue;
      }

      if (record?.type === 'event_msg') {
        const item = payload.item ?? payload;
        const messageType = item?.type ?? '';
        const role = item?.role
          ?? (messageType === 'UserMessage' ? 'user' : messageType === 'AgentMessage' ? 'assistant' : 'unknown');
        const text = contentToText(item?.content ?? item?.message ?? item);
        if (text && role !== 'unknown') events.push({ role, text, timestamp, kind: 'message' });
        if (messageType === 'CommandExecution') {
          const commandOutput = [item?.stderr, item?.stdout].filter(Boolean).join('\n');
          if (commandOutput) events.push({ role: 'tool', text: commandOutput, timestamp, kind: 'tool-output' });
        }
      }
    }

    return { events, filePath };
  } catch {
    return null;
  }
}

export default {
  name: 'Codex',
  experimental: false,
  find,
  parse,
};
