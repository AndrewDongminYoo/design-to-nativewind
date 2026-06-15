# figma-to-nativewind — Product Requirements / Blueprint

Status: Draft v0.1
Owner: Andrew (AndrewDongminYoo)
Last updated: 2026-06-15

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

The conversion pipeline is isolated from the Figma runtime so it can be unit-tested:

```log
Figma selection (SceneNode tree)
   │  extract.ts  (depends on figma types)
   ▼
IR  (intermediate representation, pure types)
   │  map-styles.ts  (pure) — Figma props → NativeWind classes
   ▼
IR + classes
   │  generate-rn.ts  (pure) — IR → RN + NativeWind JSX string
   ▼
component code ──(optional)──▶ llm.ts (Claude refines naming/structure)
```

Why an IR: adding a Next.js + Tailwind target later means reusing `extract` and `map-styles`
and swapping only `generate-*`.

## 5. Module Boundaries

| File                      | Responsibility                                                | Depends on  |
| ------------------------- | ------------------------------------------------------------- | ----------- |
| `src/main.ts`             | selection detection, postMessage orchestration                | figma       |
| `src/ui.tsx`              | code preview, copy, settings UI                               | preact      |
| `src/core/ir.ts`          | IR type definitions                                           | none (pure) |
| `src/core/extract.ts`     | Figma node → IR                                               | figma types |
| `src/core/map-styles.ts`  | IR style → NativeWind classes (scale snap vs arbitrary value) | pure        |
| `src/core/generate-rn.ts` | IR → RN + NativeWind JSX                                      | pure        |
| `src/core/llm.ts`         | optional Claude refinement; API key in `figma.clientStorage`  | fetch       |

## 6. Intermediate Representation (IR)

A normalized, framework-agnostic node:

- `type`: `frame | text | image | unknown`
- `name`: original Figma layer name
- `layout`: direction (`row`/`column`), align/justify, `gap`, `padding`
- `size`: width/height behavior (`fill` / `hug` / fixed)
- `style`: background, border, corner radius, opacity
- `text`: content + typography (font size/weight/line height/color) for text nodes
- `children`: nested IR nodes

## 7. MVP Conversion Coverage

In scope (v1):

- Auto Layout → flex: direction, align/justify, `gap`, `padding`.
- Sizing: fill vs hug vs fixed → flex / fixed width-height classes.
- Fills → `bg-[#hex]` (token mapping is future work).
- Corner radius → `rounded-*`.
- Typography → `text-*` / `font-*`, text content.
- Images → `<Image>` placeholder with intrinsic size.
- RN primitives limited to `View`, `Text`, `Image`, `ScrollView`.

Out of scope (v1, best-effort or skipped):

- Non-auto-layout absolute positioning (best-effort only).
- Vectors / boolean ops, component variants, animations.

## 8. Style Mapping Strategy

For numeric values (spacing, radius, font size), snap to the nearest Tailwind/NativeWind scale step
when within a tolerance; otherwise emit an arbitrary value (`p-[13px]`).
Colors emit arbitrary hex in v1; named-token mapping is future work.
The snap-vs-arbitrary tolerance is configurable in settings.

## 9. LLM-Assisted Mode (Optional)

Off by default. When enabled, the deterministic output plus the IR are sent to the Claude API
to improve component naming, extract repeated subtrees, and tidy structure — without changing the visual result.
The API key is stored in `figma.clientStorage` (never committed).
Requires `networkAccess` for the Anthropic domain in `manifest.json`.

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

Minimum verification command: `npm run build && npm test`.

## 12. Milestones

1. M0 — Scaffold + IR types + empty pipeline that round-trips a trivial frame.
2. M1 — Deterministic Auto Layout + spacing + color + text mapping (the MVP coverage above).
3. M2 — UI polish: preview, copy, settings (snap tolerance).
4. M3 — Optional LLM cleanup pass.
5. M4 (future) — Next.js + Tailwind renderer reusing the IR.

## 13. Open Questions

- Token mapping: should colors/spacing map to a project's design tokens, or stay arbitrary? (Deferred to M4.)
- Multi-frame selection: emit one component per frame or a combined file? (Default: one component per top-level frame.)
- Component extraction heuristics for repeated subtrees. (Deferred to M3, LLM-assisted.)
