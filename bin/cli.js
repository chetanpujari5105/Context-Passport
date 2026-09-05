#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import chalk from 'chalk';
import clipboardy from 'clipboardy';
import { Command } from 'commander';
import { getAdapter } from '../src/adapters/index.js';
import { injectHandoff } from '../src/inject.js';
import { exportPassport } from '../src/passport.js';

const program = new Command();
program
  .name('context-passport')
  .description('Create a compact, local handoff for continuing a coding session in another AI account.')
  .version('0.1.0')
  .option('--tool <name>', 'force a session-log adapter when exporting');

function selectedTool(options = {}) {
  return options.tool ?? program.opts().tool;
}

function validateTool(tool) {
  if (tool && !getAdapter(tool)) {
    throw new Error(`Unknown tool "${tool}". Choose Codex, Claude Code, or Cursor.`);
  }
}

function runExport(options = {}) {
  const tool = selectedTool(options);
  validateTool(tool);
  const result = exportPassport({ tool });
  const tokenEstimate = Math.ceil(result.markdown.length / 4);
  console.log(chalk.green(`Wrote ${path.basename(result.outputPath)}`));
  console.log(`Source adapter: ${result.adapterName}`);
  console.log(`Size: ${result.markdown.length} characters (~${tokenEstimate} tokens)`);
  return result;
}

program
  .command('export')
  .description('Extract the latest local coding-session context into handoff.md')
  .option('--tool <name>', 'force a specific adapter instead of auto-detection')
  .action((options) => {
    runExport(options);
  });

program
  .command('show')
  .description('Print the current handoff.md')
  .option('--clipboard', 'copy handoff.md to the clipboard instead of printing it')
  .action(async (options) => {
    const handoffPath = path.join(process.cwd(), 'handoff.md');
    if (!fs.existsSync(handoffPath)) throw new Error('handoff.md not found. Run `context-passport export` first.');
    const markdown = fs.readFileSync(handoffPath, 'utf8');
    if (options.clipboard) {
      await clipboardy.write(markdown);
      console.log(chalk.green('Copied handoff.md to the clipboard.'));
    } else {
      process.stdout.write(markdown);
    }
  });

program
  .command('inject')
  .description('Insert handoff.md into AGENTS.md or CLAUDE.md between Context Passport markers')
  .action(() => {
    const handoffPath = path.join(process.cwd(), 'handoff.md');
    if (!fs.existsSync(handoffPath)) throw new Error('handoff.md not found. Run `context-passport export` first.');
    const target = injectHandoff(fs.readFileSync(handoffPath, 'utf8'));
    console.log(chalk.green(`Injected handoff into ${path.basename(target)}.`));
  });

function parseInterval(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 525600) {
    throw new Error('Interval must be a positive number of minutes no greater than 525600.');
  }
  return minutes;
}

program
  .command('watch')
  .description('Refresh handoff.md on a timer until interrupted')
  .option('--interval <minutes>', 'refresh interval in minutes', parseInterval, 10)
  .option('--tool <name>', 'force a specific adapter instead of auto-detection')
  .action((options) => {
    const intervalMinutes = options.interval;
    validateTool(selectedTool(options));
    let refreshing = false;
    const refresh = () => {
      if (refreshing) return;
      refreshing = true;
      try {
        runExport(options);
        console.log(chalk.dim(`[${new Date().toISOString()}] handoff refreshed`));
      } catch (error) {
        console.error(chalk.red(`[${new Date().toISOString()}] refresh failed: ${error.message}`));
      } finally {
        refreshing = false;
      }
    };

    refresh();
    const timer = setInterval(refresh, intervalMinutes * 60 * 1000);
    const stop = () => {
      clearInterval(timer);
      console.log(chalk.yellow('\nStopped watching for session updates.'));
      process.exit(0);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });

program.parseAsync().catch((error) => {
  console.error(chalk.red(`context-passport: ${error.message}`));
  process.exitCode = 1;
});
