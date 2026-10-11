# Claude Code 2.1.88 — Custom Build

![](<img/2026-03-31 14-58-01-combined.gif>)

Rebuilt from source maps with real source preservation for `@ant/*` packages.

## Prerequisites

- Node.js >= 20
- Bun >= 1.1
- npm (for overlay dependency install on first build)

## Build

```bash
# Production (minified)
node scripts/build-cli.mjs

# Development (unminified, faster builds)
node scripts/build-cli.mjs --no-minify

# Custom output path
node scripts/build-cli.mjs --outfile /path/to/output/cli.js
```

Output: `dist/cli.js` (wrapper) + `dist/cli.bundle/` (bundle).

First build runs `npm install` for ~80 overlay packages. Subsequent builds skip this.

## Run

```bash
node dist/cli.js
```

### Computer Use (macOS)

Computer use runs in-process automatically when the `CHICAGO_MCP` flag is enabled. The native addons are resolved from `prebuilds/` relative to the bundled package, or via env var overrides:

```bash
# Override native addon paths if the default resolution fails
COMPUTER_USE_SWIFT_NODE_PATH="/path/to/computer-use-swift.node" \
COMPUTER_USE_INPUT_NODE_PATH="/path/to/computer-use-input.node" \
node dist/cli.js
```

## Feature Flags

| Flag | What it does |
|------|-------------|
| `BUILDING_CLAUDE_APPS` | Skill content for building Claude apps |
| `BASH_CLASSIFIER` | Bash command safety classifier |
| `TRANSCRIPT_CLASSIFIER` | Transcript-level auto-mode classifier |
| `CHICAGO_MCP` | Computer use via MCP (screenshot, click, type, etc.) |

Toggle in `enabledBundleFeatures` inside `scripts/build-cli.mjs`. ~90 flags available — search `feature('` in source.

## JARVIS maximum feature profile

The build script now defaults to the **maximum** compile-time feature profile.
It scans the extracted `source/src` workspace for literal `feature('FLAG_NAME')`
calls, enables every discovered compile-time gate, and preserves the four
previously enabled defaults. This includes normally disabled gates whenever
their original call sites are present in the reconstructed sources.

```bash
# Inspect the discovered flag names and their source-file locations
node scripts/build-cli.mjs --list-features

# Build with maximum discovered compile-time gates (default)
node scripts/build-cli.mjs --max-features

# Debugging / regression comparison only: original four-gate profile
node scripts/build-cli.mjs --baseline-features
```

Each attempted build writes `dist/claude-feature-manifest.json` with the
discovered and enabled gate names, source-file occurrences, and build status.
The manifest distinguishes **compiled** from **runtime-tested** capability.

**Important:** enabling a compile-time gate does not make an absent server,
subscription-dependent cloud capability, or unavailable native library work.
Some reconstructed `@ant/*` packages are currently stubs and cannot provide
their original behavior. Non-literal/dynamic flags also require follow-up audit.
Before integrating a gated feature into JARVIS, verify the real underlying
implementation, Windows support, permissions and network behavior individually.

The generated JARVIS wrapper sets `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`,
`DISABLE_TELEMETRY=1`, and `CLAUDE_CODE_ENABLE_TELEMETRY=0` by default
when they are not already set in the environment. The permitted OpenRouter
AI connection still needs network access. These settings suppress known
nonessential traffic paths but are not proof of zero unexpected requests;
network observation and an allowlist are still needed.

Runtime GrowthBook feature values can be supplied by JARVIS independently
of Anthropic remote configuration, for example:

```bash
BRAHMA_CLAUDE_FEATURE_OVERRIDES='{"example_experiment_key":true}' node dist/cli.js
```

Override keys and value types must be checked against the actual feature
call sites. Do **not** indiscriminately override security restrictions or
assume that turning on a gate supplies an absent native or server component.

## Native Addons

In `source/native-addons/`:

| File | Purpose |
|------|---------|
| `computer-use-swift.node` | Screen capture, app management (macOS) |
| `computer-use-input.node` | Mouse/keyboard input (macOS) |
| `image-processor.node` | Sharp image processing |
| `audio-capture.node` | Audio capture |

## Clean Rebuild

```bash
rm -f .cache/workspace/.prepared.json
node scripts/build-cli.mjs --no-minify
```

## Structure

```
scripts/build-cli.mjs    — Build script (source map extraction + bun bundling)
source/cli.js.map         — Original source map (4756 modules)
source/native-addons/     — Pre-built .node binaries
source/src/               — Overlay assets (.md skill files)
.cache/workspace/         — Extracted workspace (generated, gitignored)
dist/                     — Build output (generated)
```
