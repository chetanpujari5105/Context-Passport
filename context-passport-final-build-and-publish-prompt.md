# FINAL BUILD + PUBLISH PROMPT FOR CODEX
# Paste this entire file as your first message. Work only on this project.
# Do not stop to ask permission at any step. Execute everything end to end:
# build, test, document, git init, commit, and push to the GitHub repo below.

Target repo (already created, empty): https://github.com/chetanpujari5105/Context-Passport.git

If `git push` fails due to missing credentials/auth, do not give up silently —
run `gh auth status` to check, and if authenticated, retry the push. If not
authenticated, print the exact command I need to run to authenticate
(`gh auth login`) and then continue with everything else (finish the full
build and commit locally) so only the final push is blocked, not the whole task.

## What you are building

**Context Passport** — a CLI tool that solves a real, common problem: people
who hit AI rate limits and switch between multiple accounts (ChatGPT, Claude,
Codex, Gemini, Cursor) have to manually re-explain their entire project
context every time they switch, wasting huge amounts of tokens and time.
Context Passport extracts a small, deterministic, structured handoff summary
from the current coding session/repo state — with zero LLM calls, so it costs
nothing to generate — instead of a full transcript dump or an AI-written
summary. Typical output: 300-800 tokens instead of thousands.

This is NOT a chat-history exporter (ChatGPT/Claude already have those). It
is specifically for coding agents (Codex CLI, Claude Code) and their local
session logs plus git state, which no existing tool reads.

## Non-negotiable design rules

1. Zero LLM/API calls anywhere in the tool itself. Pure local parsing: regex,
   git commands, filesystem reads. No API keys required to run it.
2. Fully offline after `npm install`. Never phones home, never uploads
   anything anywhere by default.
3. Must support multiple AI coding tools' session logs via a pluggable
   adapter system, not just one tool.
4. Output must be small and skimmable — hard cap the rendered handoff at
   roughly 3000 characters (~800 tokens), truncating with "..." if exceeded.

## Tech stack

- Node.js 18+, plain JS (no build step needed, simpler for contributors to
  read and for you to maintain).
- Dependencies: `commander` (CLI parsing), `chalk` (colored output),
  `clipboardy` (clipboard access). Nothing else unless truly required.
- Ships with a `bin` entry so it eventually works via `npx context-passport`.

## Step 0 — Discover real log formats before writing parsers

Before writing any parser, inspect this machine for real session logs and
adapt to what actually exists, rather than assuming a schema from memory:

- `~/.codex/sessions/`
- `~/.claude/projects/`
- `~/.cursor/` if present
- Any other `.jsonl`/`.json`/`.log` files under tool config dirs in the home
  directory

Write one adapter file per tool in `src/adapters/` (e.g. `codex.js`,
`claude.js`, `cursor.js`). Each adapter exports a `find()` function that
locates the latest relevant session file for the current project directory,
and a `parse()` function returning raw extracted text/events. If a tool's
logs aren't present on this machine, still implement a best-effort adapter
from the format clues you can find in any local docs/config, mark it
`experimental: true`, and make it fail gracefully (return null, never throw)
if expected files are missing at runtime.

## Step 1 — Extraction logic (`src/extract.js`)

Produce this fixed-shape object regardless of which adapter supplied data:

```js
{
  goal: string,              // best-effort from first user message in session, or an "## Task"/"## Goal" section in AGENTS.md/CLAUDE.md if present
  decisionsLocked: string[], // lines matching decision patterns: "decided to", "using X instead of Y", "we will", "settled on", "going with" (case-insensitive)
  filesTouched: string,      // `git diff --stat HEAD` output (or against last commit if uncommitted changes exist), max 15 lines, "+N more" suffix if truncated
  currentState: string,      // last 2 assistant actions/messages from the session log, ~200 chars each max
  lastError: string | null,  // most recent error-looking line in the session log
  nextStep: string           // last unresolved TODO/question in the session, or the final message if nothing else matches
}
```

## Step 2 — Render to markdown (`src/render.js`)

Output to `handoff.md` in the current directory:

```
# Context Passport Handoff
Generated: <ISO timestamp>
Source tool: <adapter name used>

## Goal
<goal>

## Decisions Locked
- <decision>

## Files Touched
<git diff --stat output>

## Current State
<currentState>
<if lastError present: "⚠️ Last error: <lastError>">

## Next Step
<nextStep>

---
Paste this into your new AI account/session as your first message before continuing.
```

Omit any section with no data rather than printing an empty header.

## Step 3 — CLI commands (`bin/cli.js`, using `commander`)

- `context-passport export` — runs extraction + render, writes `handoff.md`,
  prints adapter used + character/token estimate.
- `context-passport show [--clipboard]` — prints `handoff.md`; with
  `--clipboard`, copies via `clipboardy` instead of printing full text.
- `context-passport inject` — prepends `handoff.md` content between
  `<!-- CONTEXT PASSPORT START -->` / `<!-- CONTEXT PASSPORT END -->` markers
  into `AGENTS.md` (or `CLAUDE.md` if that's what exists, or create
  `AGENTS.md` if neither exists). On re-run, replace content between markers
  instead of duplicating.
- `context-passport watch [--interval <minutes>]` — re-runs export every N
  minutes (default 10), prints timestamped refresh log lines, exits cleanly
  on SIGINT.
- `context-passport --tool <name>` flag on `export` to force a specific
  adapter instead of auto-detecting the most recently modified one.
- `--version` and `--help` via commander defaults.

## Step 4 — Tests

Write real tests (use Node's built-in `node:test` module, no extra
dependency needed) covering at minimum:
1. Render output omits empty sections correctly.
2. `filesTouched` truncates at 15 lines with correct suffix.
3. `inject` replaces content between markers on a second run instead of
   duplicating it.
4. At least one adapter's `parse()` handles a missing/malformed log file
   without throwing.

Run all tests yourself (`node --test`) and fix any failures before moving on.
Do not proceed to publishing with failing tests.

## Step 5 — Documentation (this is a public repo, document it like one)

Write `README.md` with, in this order:
1. One-sentence description of what it does and who it's for.
2. The problem it solves, in plain language a non-technical reader can
   understand in 10 seconds (multi-account AI users wasting tokens
   re-explaining context).
3. Quick start: install + first command, copy-pasteable.
4. Full command reference table (command, flags, what it does).
5. "How it works" section explaining the zero-LLM-call, local-only design
   and why that matters (no cost, no privacy leak, works offline).
6. Supported tools table (Codex, Claude Code, Cursor) with which are fully
   supported vs. experimental.
7. Example: a real before/after showing a bloated manual context paste vs.
   the compact `handoff.md` output.
8. Contributing section: how to add a new adapter for another tool.
9. License section (add an MIT `LICENSE` file too).

Also add:
- `CONTRIBUTING.md` with basic setup + test-running instructions.
- Inline code comments only where logic isn't self-evident — do not
  over-comment.
- A `.gitignore` covering `node_modules/`, `handoff.md` (it's user-specific
  output, shouldn't be committed from the repo's own test runs), and OS
  cruft files.

## Step 6 — Git init, commit, and publish

1. `git init` in the project root if not already a repo.
2. `git add -A` and commit with a clear message
   (e.g. "Initial release: Context Passport CLI v0.1.0").
3. Add the remote: `git remote add origin https://github.com/chetanpujari5105/Context-Passport.git`
   (use `set-url` instead if a remote named `origin` already exists).
4. Set the default branch to `main` if not already.
5. Push: `git push -u origin main`.
6. If push fails due to auth, follow the auth-failure instructions at the
   top of this prompt, but still complete every other step so only the
   push itself is pending.

## Step 7 — package.json details

Set: `name: "context-passport"`, `version: "0.1.0"`, correct `bin` field
pointing to `bin/cli.js` with a `#!/usr/bin/env node` shebang, a `description`
field summarizing the tool in one line, `keywords` (ai, cli, context,
tokens, codex, claude), `license: "MIT"`, and `repository` field pointing to
the GitHub URL above. Do not run `npm publish` — only prepare the package,
do not publish to the npm registry.

## Definition of done

Before declaring finished:
1. Run `node bin/cli.js export` and `node bin/cli.js show` in this repo and
   confirm real output is produced from this actual project's git state.
2. Run all tests and confirm they pass.
3. Confirm the GitHub push succeeded (or report the exact auth blocker if
   it didn't, with everything else fully complete).
4. Give me a final summary: repo URL, what got built, test results, and the
   real `handoff.md` content it generated on this project as proof it works.

Work only on this project. Do not touch any other files, repos, or projects
on this machine.
