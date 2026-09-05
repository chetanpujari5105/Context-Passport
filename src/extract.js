import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { detectAdapter } from './adapters/index.js';
import { truncateText } from './adapters/utils.js';

const DECISION_PATTERN = /\b(?:decided to|using\b.+\binstead of\b|we will|settled on|going with)\b/i;
const ERROR_PATTERN = /(?:\bnpm\s+error\b|\bfatal:|\b(?:[A-Za-z]+)?Error:|\bexception\b|\btraceback\b|\bENOENT\b|\bEACCES\b|\bERR_[A-Z_]+\b|\b(?:command|build|test|push|install)\s+failed\b)/i;
const PLATFORM_CONTEXT_PATTERN = /^(?:# AGENTS\.md instructions|<environment_context>|<skills_instructions>|<permissions instructions>|<collaboration_mode>|<apps_instructions>|<plugins_instructions>|<app-context>)/i;

export function truncateStatLines(value, maxLines = 15) {
  const lines = (Array.isArray(value) ? value : String(value ?? '').split(/\r?\n/))
    .map((line) => line.trimEnd())
    .filter(Boolean);
  if (lines.length <= maxLines) return lines.join('\n');
  if (maxLines < 2) return `+${lines.length} more`;
  const retained = lines.slice(0, maxLines - 1);
  return [...retained, `+${lines.length - retained.length} more`].join('\n');
}

function runGit(cwd, args) {
  try {
    const result = spawnSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return result.status === 0 ? result.stdout.trim() : '';
  } catch {
    return '';
  }
}

export function getFilesTouched(cwd = process.cwd()) {
  const againstHead = runGit(cwd, ['diff', '--stat', 'HEAD']);
  if (againstHead) return truncateStatLines(againstHead);

  const unstaged = runGit(cwd, ['diff', '--stat']);
  const staged = runGit(cwd, ['diff', '--cached', '--stat']);
  return truncateStatLines([unstaged, staged].filter(Boolean).join('\n'));
}

export function readInstructionGoal(cwd = process.cwd()) {
  for (const filename of ['AGENTS.md', 'CLAUDE.md']) {
    try {
      const contents = fs.readFileSync(path.join(cwd, filename), 'utf8');
      const lines = contents.split(/\r?\n/);
      const headingIndex = lines.findIndex((line) => /^#{1,6}\s*(?:task|goal)\s*$/i.test(line));
      const sectionLines = [];
      for (let index = headingIndex + 1; headingIndex >= 0 && index < lines.length; index += 1) {
        if (/^#{1,6}\s/.test(lines[index])) break;
        sectionLines.push(lines[index]);
      }
      const goal = sectionLines
        .map((line) => line.replace(/^[-*]\s*/, '').trim())
        .find(Boolean);
      if (goal) return truncateText(goal, 500);
    } catch {
      // Missing project instructions are normal.
    }
  }
  return '';
}

export function getGoal(events, cwd = process.cwd()) {
  for (const event of events) {
    if (event.role?.toLowerCase() !== 'user' || !event.text?.trim()) continue;
    const withoutPluginCatalog = String(event.text)
      .replace(/<recommended_plugins>[\s\S]*?<\/recommended_plugins>/gi, '')
      .trim();
    if (withoutPluginCatalog && !/^<recommended_plugins>/i.test(withoutPluginCatalog) && !PLATFORM_CONTEXT_PATTERN.test(withoutPluginCatalog)) {
      return truncateText(withoutPluginCatalog, 500);
    }
  }
  return readInstructionGoal(cwd);
}

export function collectDecisions(events) {
  const decisions = [];
  const seen = new Set();
  for (const event of events) {
    if (event.kind === 'action' || (event.kind && event.kind !== 'message') || !/^(user|assistant)$/i.test(event.role ?? '')) continue;
    for (const line of String(event.text ?? '').split(/\r?\n/)) {
      const candidate = line.trim();
      const narrative = candidate.replace(/^[-*]\s+/, '');
      if (!narrative || /^(?:[A-Za-z_$][\w$]*\s*:|```)/.test(narrative) || !DECISION_PATTERN.test(narrative)) continue;
      const compact = truncateText(narrative, 300);
      if (!seen.has(compact)) {
        seen.add(compact);
        decisions.push(compact);
      }
    }
  }
  return decisions.slice(0, 10);
}

export function getCurrentState(events) {
  return events
    .filter((event) => event.role?.toLowerCase() === 'assistant' && event.text?.trim())
    .slice(-2)
    .map((event) => `- ${truncateText(event.text, 200)}`)
    .join('\n');
}

export function getLastError(events) {
  for (let eventIndex = events.length - 1; eventIndex >= 0; eventIndex -= 1) {
    const event = events[eventIndex];
    const canContainRuntimeError = event.kind === 'tool-output'
      || event.role?.toLowerCase() === 'tool'
      || (event.role?.toLowerCase() === 'assistant' && event.kind !== 'action');
    if (!canContainRuntimeError || /# Context Passport Handoff|"output":"# Context Passport Handoff/.test(event.text ?? '')) continue;
    const lines = errorSearchLines(event.text);
    for (let lineIndex = lines.length - 1; lineIndex >= 0; lineIndex -= 1) {
      if (/^\s*(?:⚠️\s*)?last error:/i.test(lines[lineIndex])) continue;
      if (ERROR_PATTERN.test(lines[lineIndex])) return truncateText(lines[lineIndex], 400);
    }
  }
  return null;
}

function errorSearchLines(text) {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.output === 'string') return parsed.output.split(/\r?\n/);
  } catch {
    // Ordinary message text is not JSON.
  }
  return String(text ?? '').split(/\r?\n/);
}

export function getNextStep(events) {
  for (let eventIndex = events.length - 1; eventIndex >= 0; eventIndex -= 1) {
    const event = events[eventIndex];
    if (event.kind === 'tool-output' || event.kind === 'action' || !/^(user|assistant)$/i.test(event.role ?? '')) continue;
    const lines = String(event.text ?? '').split(/\r?\n/);
    for (let lineIndex = lines.length - 1; lineIndex >= 0; lineIndex -= 1) {
      const line = lines[lineIndex].trim();
      if (/^[\w$.]+\([^)]*\)\s*\/\//.test(line)) continue;
      const isTestStatus = /^ℹ\s*todo\s+\d+$/i.test(line);
      if ((!isTestStatus && /\b(?:TODO|next step|next:|remaining|follow[- ]up)\b/i.test(line)) || /\?\s*$/.test(line)) {
        return truncateText(line, 500);
      }
    }
  }

  const finalMessage = [...events].reverse().find((event) => event.role?.toLowerCase() === 'assistant' && event.text?.trim())
    ?? [...events].reverse().find((event) => event.text?.trim());
  return finalMessage ? truncateText(finalMessage.text, 500) : '';
}

export function buildPassport(events = [], cwd = process.cwd()) {
  return {
    goal: getGoal(events, cwd),
    decisionsLocked: collectDecisions(events),
    filesTouched: getFilesTouched(cwd),
    currentState: getCurrentState(events),
    lastError: getLastError(events),
    nextStep: getNextStep(events),
  };
}

export function extractWithSource({ cwd = process.cwd(), tool } = {}) {
  const { adapter, filePath } = detectAdapter(cwd, tool);
  let parsed = null;
  if (adapter && filePath) {
    try {
      parsed = adapter.parse(filePath);
    } catch {
      parsed = null;
    }
  }

  return {
    passport: buildPassport(parsed?.events ?? [], cwd),
    adapterName: adapter?.name ?? 'No session log found',
    sourcePath: parsed?.filePath ?? filePath ?? null,
  };
}

export function extract(options = {}) {
  return extractWithSource(options).passport;
}
