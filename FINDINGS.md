# Findings: Runtime Migration Status (Bun -> Deno)

Last updated: 2026-02-14

This file summarizes the current migration/debug state in `packages/opencode` based on the latest edits and runtime reports.

## Scope

Goal: run `opencode` runtime directly on Deno APIs (compiled path), removing Bun-only runtime assumptions.

## Confirmed Changes

### 1) PTY Runtime Migration

- Added Deno PTY integration via `jsr:@sigma/pty-ffi`.
- `packages/opencode/src/pty/index.ts` now points to Deno-backed implementation.
- New adapter file: `packages/opencode/src/pty/sigma.ts`.

### 2) Bun FFI Removal in TUI Win32 Path

- `packages/opencode/src/cli/cmd/tui/win32.ts` moved from `bun:ffi` usage to Deno-native dynamic library APIs.

### 3) Worker Runtime Compatibility

- Worker creation updated to module workers (`type: "module"`) in TUI thread path.
- Addressed classic-worker runtime failure in compiled Deno mode.

### 4) Timer `.unref()` Compatibility

- Call sites requiring `.unref()` were moved to Node timer imports (`node:timers`) to avoid Deno web-timer numeric handle mismatch.

### 5) Build Script / Dependency Resolution

- Removed failing `npm install --no-workspaces` path that broke on `workspace:*`.
- Build externalization was adjusted for `npm:` and `jsr:`-style runtime specifiers.

### 6) Runtime Specifier Imports

- `semver` and `mime-types` imports updated for Deno/npm specifier handling in runtime build path.

### 7) File Watcher Native Binding Handling

- Missing `@parcel/watcher-*` native binding on compiled target now degrades gracefully (watcher disabled) instead of hard-failing startup.

### 8) RPC / Worker Error Surfacing

- RPC path now reports worker-side errors more explicitly.
- Worker unhandled errors log stack/message for diagnosis.

### 9) Server Binding Fixes

- Deno server invocation and binding fallback behavior were corrected in worker server startup path.

### 10) Stream/Session Prompt Hardening

- Prompt loop no longer assumes async stream objects are arrays.
- Stream materialization was added where indexed access is needed.

### 11) Glob Runtime Replacement (New Utility)

- Added Deno-based glob helper: `packages/opencode/src/util/glob.ts`.
- Added both async and sync scan APIs:
  - `scan(...)`
  - `scanSync(...)`
- `**/*` behavior was fixed to include top-level files (critical for storage listing paths).

### 12) Local Custom Tool Loader Compatibility (`.opencode/tool/*`)

- Local GitHub tools were converted away from `@opencode-ai/plugin` import dependency.
- Files now export plain tool objects and avoid TypeScript-only syntax in runtime-loaded tool scripts:
  - `.opencode/tool/github-triage.ts`
  - `.opencode/tool/github-pr-search.ts`
- Text descriptions are read via `Deno.readTextFileSync(new URL(..., import.meta.url))`.

## Major Root Causes Found

1. Async iterable vs array misuse in session prompt logic caused missing-message failures and "Impossible"/empty-stream outcomes.
2. Glob compatibility gap (`scanSync` missing, `**/*` mismatch) caused tool registry/storage enumeration failures.
3. Runtime-loaded local tool scripts depended on package imports and TS syntax not guaranteed in the loader context.

## Current User-Observed State

- Startup progresses further than initial migration attempts.
- Session creation and message POST paths occur.
- Additional runtime errors still appear intermittently in user environment (exact latest first-failure line should be used as next breakpoint).

## Known Risk Areas Remaining

- Very large dirty tree with many partially migrated files; regressions may originate outside recently patched files.
- Deno compile/runtime behavior differs from direct `deno run`; some failures only reproduce in compiled artifact.
- External local state/config (`~/.config/opencode`, `~/.local/share/opencode`) may preserve stale data and mask code-level fixes.

## Recommended Next Debug Sequence

1. Clear runtime state (backup then reset):
   - `~/.local/share/opencode/storage`
2. Rebuild single target:
   - `cd packages/opencode && deno task build --single`
3. Run with logs and capture first error only:
   - `./dist/opencode-darwin-arm64/bin/opencode --print-logs`
4. Patch strictly from first failing stack frame (avoid speculative fixes).

## Files Most Relevant Right Now

- `packages/opencode/src/session/prompt.ts`
- `packages/opencode/src/session/message-v2.ts`
- `packages/opencode/src/util/glob.ts`
- `packages/opencode/src/tool/registry.ts`
- `packages/opencode/src/cli/cmd/tui/thread.ts`
- `packages/opencode/src/cli/cmd/tui/worker.ts`
- `packages/opencode/src/server/server.ts`
- `.opencode/tool/github-triage.ts`
- `.opencode/tool/github-pr-search.ts`
