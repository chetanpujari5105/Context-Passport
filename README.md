# Context Passport

Context Passport is a local CLI for developers who switch between AI coding accounts and need a compact, structured handoff instead of re-explaining their project from scratch.

## The problem

When an AI account hits a rate limit, changing to another account often means pasting a huge chat history and retelling the same project story. That wastes time, tokens, and attention. Context Passport reads your local coding-session log and Git state to create a small `handoff.md` you can paste into the next session.

## Quick start

From a checkout:

```sh
git clone https://github.com/chetanpujari5105/Context-Passport.git
cd Context-Passport
npm install
node bin/cli.js export
```

The command writes `handoff.md` in the project you are working in. After an npm release, the same CLI is available as `npx context-passport export`.

## Command reference

| Command | Flags | What it does |
| --- | --- | --- |
| `context-passport export` | `--tool <codex\|claude\|cursor>` | Detects the newest matching local session log, extracts context, and writes `handoff.md`. |
| `context-passport show` | `--clipboard` | Prints `handoff.md`, or copies it to the system clipboard. |
| `context-passport inject` | — | Inserts the handoff between durable markers in `AGENTS.md`, preferring it over `CLAUDE.md`. Re-running replaces the old block. |
| `context-passport watch` | `--interval <minutes>`, `--tool <name>` | Refreshes `handoff.md` on a timer; defaults to every 10 minutes. Stop with `Ctrl+C`. |
| `context-passport --help` | — | Shows built-in help and all available options. |

`--tool` can also be placed before `export`, for example `context-passport --tool codex export`.

## How it works

Context Passport makes zero LLM or API calls. It uses local filesystem reads, tolerant JSONL parsing, and `git diff --stat` to extract the first user goal, decisions, touched files, recent assistant activity, errors, and a next step. The renderer hard-caps the result at roughly 3,000 characters.

That means there is no per-export cost, no API key, no chat upload, and no network dependency once `npm install` has finished. Your session logs stay on your machine; only the `handoff.md` you choose to paste moves to another service.

## Supported tools

| Tool | Status | Session source |
| --- | --- | --- |
| Codex | Fully supported | `~/.codex/sessions/**/*.jsonl` |
| Claude Code | Fully supported | `~/.claude/projects/**/*.jsonl` |
| Cursor | Experimental | Best-effort local `.cursor` JSON/JSONL/log discovery |

Missing logs are normal: an adapter returns no session instead of crashing, and Git-only context can still be rendered.

## Example

Before Context Passport, a manual switch can look like this:

> “I’m working on a CLI in a new repo. Here are the last 200 messages, the package setup, the error output, the files I changed, and the decisions we made…”

That can easily be several thousand tokens. A generated handoff is deliberately skimmable instead:

```md
# Context Passport Handoff
Generated: 2026-09-05T10:15:00.000Z
Source tool: Codex

## Goal
Build a local CLI that creates compact coding-session handoffs.

## Decisions Locked
- Use plain Node.js with no LLM or API calls.

## Files Touched
 src/extract.js | 86 +++++++++++++++++
 src/render.js  | 42 ++++++++

## Current State
- Added local session extraction and Markdown rendering.

## Next Step
Run the tests and paste this file into the new session.
```

## Contributing

New AI tools are welcome. Add an adapter in `src/adapters/` that exports `find(projectDir)` and `parse(filePath)`, register it in `src/adapters/index.js`, and add a fixture-based test for its log shape. Keep adapters local-only, tolerant of missing or malformed files, and focused on useful human-visible text.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and test instructions.

## License

Context Passport is available under the [MIT License](LICENSE).
