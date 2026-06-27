# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Figma plugin that converts a selected design subtree into React Native + NativeWind component code.
Conversion is deterministic by default (rule-based Figma-property → NativeWind-class mapping); an optional LLM pass via the Claude API refines naming/structure without changing the visual result.
[BLUEPRINT.md](./BLUEPRINT.md) is the source of truth for product requirements, milestones, and the rationale behind the IR.

## Commands

The package manager is **pnpm** (`pnpm-lock.yaml`); the `pnpm`-prefixed scripts below also work under `npm` (`npm run <script>`).

```bash
pnpm install          # applies pnpm patchedDependencies (see Patches below)
pnpm watch            # build the plugin in watch mode (build/main.js, build/ui.js)
pnpm build            # one-off typechecked + minified build
pnpm test             # vitest run (all unit tests)
pnpm test:watch       # vitest in watch mode
pnpm lint             # eslint over src/**/*.{ts,tsx}
pnpm typecheck        # tsc --noEmit

# Run a single test file or filter by name
pnpm vitest run src/core/__tests__/generate-rn.test.ts
pnpm vitest run -t "snapSpacing"
```

Minimum verification after changes: `pnpm build && pnpm test`.
Load in Figma desktop via Plugins → Development → Import plugin from manifest, pointing at the generated `manifest.json`.

## Architecture

### Two Figma contexts (`postMessage` boundary)

Figma plugins run in two isolated contexts that communicate only via messages:

- **Sandbox** ([src/main.ts](src/main.ts)) — has `figma.*` access to the document/selection, no DOM, no network.
- **UI iframe** ([src/ui.tsx](src/ui.tsx)) — Preact webview; renders preview/settings and can make network calls.

Messages are typed handler interfaces (`ConvertHandler`, `CodeGeneratedHandler`, `ConversionErrorHandler`, `ImportThemeHandler`) **defined in [src/main.ts](src/main.ts) and imported by the UI**, sent with `emit`/`on` from `@create-figma-plugin/utilities`.
When adding a message type, declare its handler interface in `main.ts` so both sides share one definition.

### Two run modes (`figma.mode` branch in `main.ts`)

`main()` forks on `figma.mode`:

- **Codegen** (Dev Mode code generator, the primary path) — registers `figma.codegen.on('generate')` and stays resident; the selected node is converted on every selection change with no run UI (`showUI` is disallowed inside the generate callback). Codegen preferences (`snap`, `reuse`, `import`) come from the `codegenPreferences` in [package.json](package.json) and are read via `figma.codegen.preferences.customSettings`. The `import` action is an exception: it fires `preferenceschange`, where `showUI` _is_ allowed, to open the theme-import iframe.
- **Run** (design mode / Dev Mode run) — shows the preview + copy UI and converts the first selected node on a `CONVERT` message.

Codegen preferences map to pipeline behavior via `codegenOptions()`: `snap` → px `tolerance`, `reuse` → `extractComponents`, and the imported theme → `colorTokens` (persisted in `figma.clientStorage` under `colorTokens`).

### Conversion pipeline (the IR purity boundary)

```log
Figma SceneNode → extract.ts → collapse-vectors.ts → [host: injectSvg] → generate-rn.ts → RN+NativeWind code
                                  IR                                       ├→ map-styles.ts
                                                                           ├→ extract-components.ts
                                                                           └─(optional)→ llm.ts
```

The hard rule that makes this testable: **everything except `extract.ts` is free of the Figma runtime.**

- [src/core/ir.ts](src/core/ir.ts) — pure IR type definitions (no figma, no preact). `Sizing` is `'fill' | 'hug' | { fixed: number }`. Node types: `frame | text | image | vector | unknown`. `svg` and `componentName` are injected later in the pipeline (see below).
- [src/core/extract.ts](src/core/extract.ts) — the _only_ core module that touches figma types; converts a `SceneNode` tree into IR.
- [src/core/collapse-vectors.ts](src/core/collapse-vectors.ts) — pure; folds a group of pure-vector children into one `vector` node so a multi-shape icon becomes a single `<Svg>`. A styled container (background or corner radius) stays a `View`.
- [src/core/svg-to-jsx.ts](src/core/svg-to-jsx.ts) — pure "SVGR-lite"; transforms an exported SVG string into react-native-svg JSX with no DOM/eval. Unsupported elements degrade rather than throw.
- [src/core/extract-components.ts](src/core/extract-components.ts) — pure; hoists structurally-repeated subtrees (≥2 occurrences, ≥3 nodes) into reusable sub-components, replacing them with `componentName` reference nodes. Gated by the `reuse` preference.
- [src/core/map-styles.ts](src/core/map-styles.ts) — pure; IR style → NativeWind classes.
- [src/core/generate-rn.ts](src/core/generate-rn.ts) — pure; IR → RN + NativeWind JSX string. Orchestrates `map-styles`, `extract-components`, and the SVG imports.
- [src/core/parse-theme.ts](src/core/parse-theme.ts) — pure, eval-free; extracts `hex → token-name` pairs from a user's Tailwind config or CSS theme. Feeds `colorTokens`.
- [src/core/names.ts](src/core/names.ts) — pure; sanitizes layer names into valid, non-shadowing component identifiers (avoids RN primitives + reserved words).
- [src/core/options.ts](src/core/options.ts) — pure; `GenOptions` (`tolerance`, `colorTokens`, `extractComponents`) threaded from the Figma runtime into the pure pipeline, so tests pass options directly.
- [src/core/llm.ts](src/core/llm.ts) — optional Claude refinement over `fetch`; API key lives in `figma.clientStorage`, never committed.

**One deliberate exception to the purity rule:** SVG export needs the Figma runtime (`node.exportAsync`), so `injectSvg` lives in [src/main.ts](src/main.ts) (the host) and walks the IR exporting each `vector`; the _conversion_ of that SVG string is pure (`svg-to-jsx.ts`). Keep the figma call in the host and the transform in core.

Why the IR exists: a future Next.js + Tailwind target reuses `extract` + the middle stages and swaps only `generate-*`. Keep new logic on the correct side of the purity boundary — don't reach for `figma.*` outside `extract.ts` (or the documented host-side `injectSvg`).

### Style mapping convention (snap vs arbitrary)

Numeric values (spacing, radius, font size) snap to the nearest Tailwind/NativeWind scale step when within tolerance, otherwise emit an arbitrary value like `p-[13px]`. The tolerance is data-driven: `SNAP_TOLERANCE_PX` (1px) is the default, but the live value is threaded through `GenOptions.tolerance` from the `snap` codegen preference (`strict` = 0, `default` = 1, `loose` = 2). See `snapSpacing`/`spacingClass` in [src/core/map-styles.ts](src/core/map-styles.ts). Colors emit arbitrary hex (`bg-[#RRGGBB]`) by default, but map to a token (`bg-primary-500`) when the hex is present in `colorTokens` — populated by importing a theme (`parse-theme.ts`).

## Conventions & gotchas

- **TypeScript strict** (extends `@create-figma-plugin/tsconfig`). `tsconfig.json` excludes `src/**/__tests__/**` and emits nothing — the build tool handles compilation.
- **Tests live in `src/**/**tests**/\*.test.ts`** and import the pure modules directly with IR fixtures — no Figma runtime. `extract.ts`is tested against mocked`figma` node objects.
- **`manifest.json` is generated** by `build-figma-plugin` from the `figma-plugin` field in [package.json](package.json) (which points `main`/`ui` at the `src/` sources). Edit plugin metadata there, not in the generated `manifest.json`. `networkAccess` is restricted to `https://api.anthropic.com`.
- **Patches:** [patches/](patches/) patches `@create-figma-plugin/build` so its watcher ignores `.trunk`/`.remember`/`.claude`, applied via pnpm's `patchedDependencies` (package.json `pnpm` field). Re-edit with `pnpm patch "@create-figma-plugin/build@4.0.3"` then `pnpm patch-commit <dir>` — not patch-package, which can't read `pnpm-lock.yaml`. `vitest.config.ts` likewise scopes discovery to `src/` — globbing the root follows `.trunk` symlinks into `~/.cache/trunk` and collects unrelated tests. Keep both guards when touching build/test config.
- This is a personal-account project (`AndrewDongminYoo`); keep it isolated from any work/org codebases.
