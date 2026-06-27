# figma-to-nativewind — Product Requirements / Blueprint

Status: Draft v0.1
Owner: Andrew (AndrewDongminYoo)
Last updated: 2026-06-28

## 1. Summary

A Figma plugin that converts a selected design subtree into React Native + NativeWind component code.
The conversion is deterministic by default (rule-based mapping from Figma properties to NativeWind utility classes), with an optional LLM-assisted pass for naming and structural cleanup.

The first-class target is React Native (Expo) + NativeWind.
A Next.js + Tailwind renderer is an explicit future extension, enabled by a shared intermediate representation (IR).

## 2. Problem & Goals

Designers hand off Figma frames; engineers re-implement layout, spacing, color, and typography by hand.
This is slow and error-prone, and the NativeWind class mapping (flex, gap, padding, color, font scale) is mechanical enough to automate.

Goals:

- Turn a selected Figma node tree into compilable RN + NativeWind JSX in one action.
- Keep output predictable: same input produces same output.
- Keep the core conversion logic testable without a Figma runtime.
- Make the second target (Next.js + Tailwind) cheap to add later.

Non-goals (v1):

- Pixel-perfect reproduction of arbitrary absolute-positioned layouts.
- Vector / boolean operation flattening, component variants, prototyping/animation.
- A full design-system token sync.

## 3. Users & Primary Flow

Primary user: a front-end / RN engineer who received a Figma file.

Flow:

1. Select one or more frames in Figma.
2. Run the plugin.
3. Plugin reads the selection, builds an IR, maps styles, generates RN + NativeWind code.
4. UI shows the code with a copy button.
5. (Optional) Toggle "LLM cleanup" to refine component names and structure via the Claude API.

## 4. Architecture

Figma plugins run in two contexts that communicate via `postMessage`:

- Sandbox (`main`): has `figma.*` API access to the document and selection; no DOM.
- UI (iframe): a webview that renders the preview/settings; can make network calls.

`main.ts` forks on `figma.mode`: a **Dev Mode code generator** (the primary path — converts the selection on every change, no run UI) and a classic **run plugin** (preview + copy UI, converts on demand). Codegen preferences (`snap` tolerance, `reuse`, theme `import`) are declared in `package.json` and threaded into the pipeline as `GenOptions`.

The conversion pipeline is isolated from the Figma runtime so it can be unit-tested:

```log
Figma selection (SceneNode tree)
   │  extract.ts  (depends on figma types)
   ▼
IR  (intermediate representation, pure types)
   │  collapse-vectors.ts  (pure) — fold pure-vector groups into one vector node
   ▼
IR  ──▶ host injectSvg: figma.exportAsync per vector → svg-to-jsx.ts (pure) writes react-native-svg JSX
   │  generate-rn.ts  (pure) — IR → RN + NativeWind JSX string
   │     ├─ map-styles.ts  (pure) — Figma props → NativeWind classes
   │     └─ extract-components.ts  (pure) — hoist repeated subtrees into sub-components
   ▼
component code ──(optional, run mode only)──▶ llm.ts (Claude refines naming/structure)
```

The IR is pure types; everything except `extract.ts` is free of the Figma runtime. The one deliberate exception is vector SVG export, which needs `figma.exportAsync`, so the host (`main.ts`) walks the IR and exports each vector before the pure `svg-to-jsx` transform runs.

Why an IR: adding a Next.js + Tailwind target later means reusing `extract` and the middle stages
and swapping only `generate-*`.

## 5. Module Boundaries

| File                             | Responsibility                                                       | Depends on  |
| -------------------------------- | -------------------------------------------------------------------- | ----------- |
| `src/main.ts`                    | codegen + run modes, SVG export (`injectSvg`), postMessage           | figma       |
| `src/ui.tsx`                     | code preview, copy, theme-import UI                                  | preact      |
| `src/core/ir.ts`                 | IR type definitions                                                  | none (pure) |
| `src/core/options.ts`            | `GenOptions` threaded from the runtime into the pure pipeline        | pure        |
| `src/core/extract.ts`            | Figma node → IR                                                      | figma types |
| `src/core/collapse-vectors.ts`   | fold pure-vector groups into a single `vector` node                  | pure        |
| `src/core/svg-to-jsx.ts`         | exported SVG string → react-native-svg JSX ("SVGR-lite")             | pure        |
| `src/core/map-styles.ts`         | IR style → NativeWind classes (scale snap vs arbitrary value)        | pure        |
| `src/core/extract-components.ts` | hoist repeated subtrees into reusable sub-components                 | pure        |
| `src/core/names.ts`              | sanitize layer names into safe component identifiers                 | pure        |
| `src/core/parse-theme.ts`        | extract `hex → token` map from a Tailwind/CSS theme                  | pure        |
| `src/core/generate-rn.ts`        | IR → RN + NativeWind JSX                                             | pure        |
| `src/core/llm.ts`                | optional Claude refinement (run-mode UI); API key in `clientStorage` | fetch       |

## 6. Intermediate Representation (IR)

A normalized, framework-agnostic node:

- `type`: `frame | text | image | vector | unknown`
- `name`: original Figma layer name
- `layout`: direction (`row`/`column`), align/justify, `gap`, `padding`
- `size`: width/height behavior (`fill` / `hug` / fixed)
- `style`: background, corner radius, opacity
- `text`: content + typography (font size/weight/line height/color) for text nodes
- `children`: nested IR nodes

Fields injected later in the pipeline (absent from the pure `extract` output):

- `svg`: react-native-svg render for a `vector`, written by the host after SVG export
- `componentName`: set when a node was hoisted into a sub-component and now renders as `<Name />`
- `id` / `vectorColor`: Figma node id (for host-side export) and a leaf vector's primary fill

## 7. MVP Conversion Coverage

In scope (v1):

- Auto Layout → flex: direction, align/justify, `gap`, `padding`.
- Sizing: fill vs hug vs fixed → flex / fixed width-height classes.
- Fills → `bg-[#hex]`, or `bg-<token>` when the hex matches an imported theme token.
- Corner radius → `rounded-*`.
- Typography → `text-*` / `font-*`, text content.
- Images → `<Image>` placeholder with intrinsic size.
- Vectors → real `react-native-svg` JSX (multi-shape icons collapse into one `<Svg>`).
- Repeated subtrees → hoisted into reusable sub-components (the `reuse` preference).
- RN primitives limited to `View`, `Text`, `Image`, `ScrollView` (plus `react-native-svg`).

Out of scope (v1, best-effort or skipped):

- Non-auto-layout absolute positioning (best-effort only).
- Boolean ops, component variants, animations.

## 8. Style Mapping Strategy

For numeric values (spacing, radius, font size), snap to the nearest Tailwind/NativeWind scale step
when within a tolerance; otherwise emit an arbitrary value (`p-[13px]`).
Colors emit arbitrary hex by default, or a named token (`bg-primary-500`) when the hex matches a
`hex → token` pair imported from a Tailwind config / CSS theme (`parse-theme.ts`).
The snap-vs-arbitrary tolerance is configurable via the `snap` codegen preference
(`strict` = 0px, `default` = 1px, `loose` = 2px).

## 9. LLM-Assisted Mode (Optional)

Off by default. When enabled, the deterministic output plus the IR are sent to the Claude API
to improve component naming and tidy structure — without changing the visual result.
The API key is entered in the run-mode UI and stored in `figma.clientStorage` (never committed).
Requires `networkAccess` for the Anthropic domain in `manifest.json`.

Available in the **run plugin** only, not in codegen mode: the `fetch` must run in the UI iframe,
and the codegen `generate` callback executes in the sandbox with no network and no persistent UI.
On any API/network error the UI falls back to the deterministic code and surfaces the error.
Note that repeated-subtree extraction, originally scoped here, was instead implemented
deterministically in `extract-components.ts`, so it no longer depends on the LLM pass.

## 10. Tech Stack

- `create-figma-plugin` framework (TypeScript + Preact UI + build tooling).
- TypeScript strict.
- Vitest for the pure core modules.
- ESLint + Prettier.
- Single package (no monorepo).

## 11. Testing Strategy

- Pure modules (`map-styles`, `generate-rn`, IR helpers) are unit-tested with Vitest using IR fixtures — no Figma runtime needed.
- `extract.ts` is tested against mocked `figma` node objects.
- Manual verification in Figma desktop for end-to-end runs.

Minimum verification command: `pnpm build && pnpm test`.

## 12. Milestones

1. M0 ✅ — Scaffold + IR types + empty pipeline that round-trips a trivial frame.
2. M1 ✅ — Deterministic Auto Layout + spacing + color + text mapping (the MVP coverage above).
3. M2 ✅ — UI polish: preview, copy, settings (snap tolerance); runs as a Dev Mode code generator.
4. M3 ✅ — Optional LLM cleanup pass, wired into the run-mode UI (codegen mode stays deterministic).
5. M4 (future) — Next.js + Tailwind renderer reusing the IR.

Delivered beyond the original plan (deterministically, ahead of the LLM pass): vector →
`react-native-svg` conversion, repeated-subtree extraction into sub-components, and color-token
mapping from an imported Tailwind/CSS theme.

## 13. Open Questions

- Token mapping: ✅ resolved — colors map to imported theme tokens (`parse-theme.ts`); spacing still snaps to the Tailwind scale. Spacing-token mapping remains open.
- Multi-frame selection: emit one component per frame or a combined file? (Open; current v1 converts the first top-level selected node.)
- Component extraction heuristics for repeated subtrees: ✅ resolved — implemented deterministically in `extract-components.ts` (≥2 occurrences, ≥3 nodes) rather than via the LLM. Nested repeats inside an extracted component stay inline (conservative baseline) — tuning is open.
