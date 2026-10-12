# JARVIS Claude source reconstruction — verified engineering status (2026-10-12)

**Purpose:** Provide a persistent, source-derived technical handoff. Do not infer that enabling `feature('FLAG')` restores missing implementation. The original protected `master` branch is untouched.

## Source provenance

- Primary reconstruction: this repository, integration branch `feature/jarvis-nextgen-working-runtime-20261011`, starting from `master` and its recovered `source/cli.js.map`.
- Original-source donor: [diablomike20/claude-code](https://github.com/diablomike20/claude-code), `main` commit `6ee4529f1f62631c70c948b6e654ba95668d0c6e`.
- JARVIS Windows packaging pins both source commit IDs in `installer/prepare_claude_runtime.ps1`, SHA-verifies donor and imports only 10 reviewed source files into build workspace ahead of stub generation. Windows CI previously proved **imported=10, preserved=0, reviewed=10**.
- Neither `anthropics/claude-code` nor official Claude Agent SDK repositories contain all internal CLI TypeScript module files. Official API docs specify interfaces and behavior, not this reconstructed build's missing private source implementations.

## Feature status by actual implementation

| Gate / module | Current implementation | Claims and explicit limits |
|---|---|---|
| `EXPERIMENTAL_SKILL_SEARCH` / `skillSearch/prefetch` | **LOCAL IMPLEMENTATION** — `scripts/runtime/skillPrefetch.mjs` and `skillDiscoveryCore.mjs` copied to generated workspace. Uses real `getSkillToolCommands`, optional MCP commands, deterministic lexical ranking, first-turn skill discovery and async post-write prefetch; de-duplicates. | Original proprietary AKI/model skill search is **not** recovered; relevance quality requires validation against real skill sets. Feature-check/listing remains original/fallback path and may continue listing skills. |
| `REACTIVE_COMPACT` / `compact/reactiveCompact` | **LOCAL IMPLEMENTATION** — `scripts/runtime/reactiveCompact.mjs`. Routes API prompt-overflow errors into original `compactConversation`, single attempt per recovery, honors user auto-compact setting. | Media-size specific handling is *not* implemented; full end-to-end API 413 recovery proof is a separate CI scenario. Does not assume summary succeeded if provider fails. |
| `PROACTIVE`/`KAIROS` / `proactive/index` | Compatibility state functions | No claim to autonomous background scheduling/agent work. |
| `HISTORY_SNIP` / `snipCompact`, `snipProjection` | Lossless pass-through compatibility | No intelligent history snipping; normal unrelated compact may still run. |
| `CONTEXT_COLLAPSE` / `contextCollapse/index` | Lossless pass-through compatibility | No private collapse journal or overflow drain. |
| `CACHED_MICROCOMPACT` / `cachedMicrocompact` | Compatibility module disabled | No private cache-edit operations. Existing unrelated context mechanisms remain. |

## Tests

- `scripts/tests/donor-source.test.mjs`: 4 source-provenance tests.
- `scripts/tests/skill-discovery.test.mjs`: 8 lexical retrieval, filtering, metadata-only, multilingual and pivot tests.
- `scripts/tests/skill-prefetch.test.mjs`: 4 production-prefetch module tests with injected command-adapter doubles.
- `scripts/tests/reactive-compact.test.mjs`: 5 production-reactive module tests proving invocation of original summary engine with correct parameters, user opt-outs, abort/recursion guards and errors.
- Other existing build-safety and proactive-state tests also run.
- Windows SSE run [#38197956433](https://github.com/diablomike20/Jarvis-Ai/actions/runs/38197956433): **28 unit tests PASS (0 fail), CLI->fixture SSE PASS**. Fixture replies are synthetic; no real LLM quality claim.
- A separate later Windows scenario is configured to send an initial `Prompt is too long` response and test compact/retry. Its outcome must be checked before asserting end-to-end overflow success.

## Engineering invariants

1. Never overwrite real original source files. When both repos have source, prefer verified source over guessed replacements.
2. The JARVIS application UI (including approved original 2D Orb HUD), voice assets, native permission gates and protected branches are outside the modified code path.
3. For generated modules, code with `// JARVIS-IMPLEMENTED:` means independent reconstruction, **not proprietary-original code**. Compatibility code uses `// JARVIS-RECONSTRUCTED:`. The build manifest distinguishes these statuses.
4. A Windows CLI SSE fixture response does not certify a real model, FreeCAD integration, speech synthesis fidelity, full Windows EXE installer or all claimed Claude features.
5. The user requests a truly complete standalone Windows JARVIS, not premature handoffs. Report any unverified pieces honestly.
