# Contributing to Context Passport

## Setup

```sh
git clone https://github.com/chetanpujari5105/Context-Passport.git
cd Context-Passport
npm install
```

The project uses plain Node.js ESM and supports Node.js 18 or later. There is no build step.

## Tests

Run the full test suite before opening a change:

```sh
npm test
```

You can also run the built-in runner directly:

```sh
node --test
```

## Adding an adapter

1. Add `src/adapters/<tool>.js` with `find(projectDir)` and `parse(filePath)` exports.
2. Make missing directories, missing files, malformed JSON, and partial live logs return `null` rather than throw.
3. Register the adapter in `src/adapters/index.js` and declare whether it is experimental.
4. Add a small fixture-based test using Node’s `node:test` module.
5. Keep all extraction local: adapters must not call an API, upload data, or require credentials.

Keep pull requests focused, include tests for behavior changes, and preserve the compact handoff output contract.
