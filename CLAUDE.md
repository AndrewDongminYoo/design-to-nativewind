# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Figma plugin that converts a selected design subtree into React Native + NativeWind component code.
Conversion is deterministic by default (rule-based Figma-property → NativeWind-class mapping); an optional LLM pass via the Claude API refines naming/structure without changing the visual result.
[BLUEPRINT.md](./BLUEPRINT.md) is the source of truth for product requirements, milestones, and the rationale behind the IR.

## Commands

The package manager is **pnpm** (`pnpm-lock.yaml`); the `npm`-prefixed scripts below work under either.

```bash
pnpm install          # runs patch-package via postinstall (see Patches below)
pnpm watch            # build the plugin in watch mode (build/main.js, build/ui.js)
pnpm build            # one-off typechecked + minified build
pnpm test             # vitest run (all unit tests)
pnpm test:watch       # vitest in watch mode
pnpm lint             # eslint over src/**/*.{ts,tsx}
pnpm typecheck        # tsc --noEmit

# Run a single test file or filter by name
pnpm vitest run src/core/__tests__/generate-rn.test.ts
pnpm vitest run -t "snaps spacing"
```

Minimum verification after changes: `pnpm build && pnpm test`.
Load in Figma desktop via Plugins → Development → Import plugin from manifest, pointing at the generated `manifest.json`.

## Architecture

### Two Figma contexts (`postMessage` boundary)

Figma plugins run in two isolated contexts that communicate only via messages:

- **Sandbox** ([src/main.ts](src/main.ts)) — has `figma.*` access to the document/selection, no DOM, no network.
- **UI iframe** ([src/ui.tsx](src/ui.tsx)) — Preact webview; renders preview/settings and can make network calls.

Messages are typed handler interfaces (`ConvertHandler`, `CodeGeneratedHandler`, `ConversionErrorHandler`) **defined in [src/main.ts](src/main.ts) and imported by the UI**, sent with `emit`/`on` from `@create-figma-plugin/utilities`.
When adding a message type, declare its handler interface in `main.ts` so both sides share one definition.

### Conversion pipeline (the IR purity boundary)

```log
Figma SceneNode → extract.ts → IR → map-styles.ts → generate-rn.ts → RN+NativeWind code
                                                                   └─(optional)→ llm.ts
```

The hard rule that makes this testable: **everything except `extract.ts` is free of the Figma runtime.**

- [src/core/ir.ts](src/core/ir.ts) — pure IR type definitions (no figma, no preact). `Sizing` is `'fill' | 'hug' | { fixed: number }`.
- [src/core/extract.ts](src/core/extract.ts) — the _only_ core module that touches figma types; converts a `SceneNode` tree into IR.
- [src/core/map-styles.ts](src/core/map-styles.ts) — pure; IR style → NativeWind classes.
- [src/core/generate-rn.ts](src/core/generate-rn.ts) — pure; IR → RN + NativeWind JSX string.
- [src/core/llm.ts](src/core/llm.ts) — optional Claude refinement over `fetch`; API key lives in `figma.clientStorage`, never committed.

Why the IR exists: a future Next.js + Tailwind target reuses `extract` and `map-styles` and swaps only `generate-*`. Keep new logic on the correct side of the purity boundary — don't reach for `figma.*` outside `extract.ts`.

### Style mapping convention (snap vs arbitrary)

Numeric values (spacing, radius, font size) snap to the nearest Tailwind/NativeWind scale step when within `SNAP_TOLERANCE_PX` (default 1px), otherwise emit an arbitrary value like `p-[13px]`. See `snapSpacing`/`spacingClass` in [src/core/map-styles.ts](src/core/map-styles.ts). Colors emit arbitrary hex (`bg-[#RRGGBB]`) in v1; token mapping is deferred.

## Conventions & gotchas

- **TypeScript strict** (extends `@create-figma-plugin/tsconfig`). `tsconfig.json` excludes `src/**/__tests__/**` and emits nothing — the build tool handles compilation.
- **Tests live in `src/**/**tests**/\*.test.ts`** and import the pure modules directly with IR fixtures — no Figma runtime. `extract.ts`is tested against mocked`figma` node objects.
- **`manifest.json` is generated** by `build-figma-plugin` from the `figma-plugin` field in [package.json](package.json) (which points `main`/`ui` at the `src/` sources). Edit plugin metadata there, not in the generated `manifest.json`. `networkAccess` is restricted to `https://api.anthropic.com`.
- **Patches:** [patches/](patches/) patches `@create-figma-plugin/build` so its watcher ignores `.trunk`. `vitest.config.ts` likewise scopes discovery to `src/` — globbing the root follows `.trunk` symlinks into `~/.cache/trunk` and collects unrelated tests. Keep both guards when touching build/test config.
- This is a personal-account project (`AndrewDongminYoo`); keep it isolated from any work/org codebases.
