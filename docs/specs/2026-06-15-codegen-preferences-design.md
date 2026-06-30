# Codegen Preferences, Theme Import, and Style Reuse — Design

Status: Approved (design)
Date: 2026-06-15
Related: [BLUEPRINT.md](../../../BLUEPRINT.md) (M2/M3)

## Summary

Three related capabilities for the Dev Mode code generator, built in order:

- **A. Codegen preferences baseline** — expose `unit` and a snap-tolerance selector through Figma's codegen preferences and thread them into the pure pipeline.
- **B. Theme config import** — let the user import their `tailwind.config.js` / `global.css` so generated classes use semantic color tokens (`bg-primary`) instead of arbitrary hex.
- **C. Repeated-subtree reuse** — hoist identical repeated subtrees into local sub-components.

A ships first and provides the option-plumbing the other two build on.

## Common plumbing

The pure pipeline takes an explicit options object so behavior is data-driven and testable without the Figma runtime.

```log
figma.codegen.preferences ─┐
clientStorage (theme map) ──┤→ GenOptions → generateRN(ir, opts)
                            └ run UI: defaults
```

- `src/core/options.ts` (new, pure): `GenOptions` type.

```ts
interface GenOptions {
  tolerance: number; // snap tolerance in px
  colorTokens: Record<string, string>; // lowercased hex (#rrggbb) -> token name
  extractComponents: boolean;
}
```

`main.ts` assembles `GenOptions` from `figma.codegen.preferences` (sync) plus the stored theme map (async `clientStorage`) and passes it down. The run UI uses defaults.

## A. Codegen preferences baseline (build now)

Manifest gains `codegenPreferences` (passed through the build's `rest` spread, same mechanism as `networkAccess`):

- `unit` item — Figma built-in `PIXEL` / `SCALED`. Read `preferences.unit`/`scaleFactor`; when `SCALED`, divide emitted px by `scaleFactor`.
- `select` item `snap` — `Strict` (0px) / `Default` (1px) / `Loose` (2px), mapped to `SNAP_TOLERANCE_PX`. Stored in `preferences.customSettings.snap`.

`figma.codegen.preferences` is a synchronous readonly property, so the generate callback reads it directly, derives `tolerance`, and passes it through the existing `tolerance` parameter of `map-styles`/`generate-rn`.

Changes: add `src/core/options.ts`; `main.ts` builds `GenOptions` in the codegen handler; thread `tolerance` (already supported downstream). Run UI keeps default tolerance.

Success: selecting `Loose` in Dev Mode preferences makes a 14px gap snap to `gap-3` instead of emitting `gap-[14px]`; `Strict` forces arbitrary values.

## B. Theme config import (next)

- Add an `action` codegen preference "Import theme…". In codegen mode, `figma.codegen.on('preferenceschange')` opens the import iframe with `figma.showUI` (allowed here, not inside `generate`).
- Import iframe: `<input type="file">` reads the chosen `tailwind.config.js` or `global.css` as text (FileReader), then `postMessage`s the text to `main`.
- `src/core/parse-theme.ts` (new, pure): tolerant extraction of a hex→token map.
  - Tailwind: locate the `colors: { … }` object literal and parse name→hex pairs, including one level of nesting (`primary: { 500: '#…' }` → `primary-500`). No `eval`/`Function`; regex + bracket-matching over string/identifier keys and hex string values only. Anything not a hex literal is skipped.
  - CSS: parse `--color-<name>: #hex;` custom properties and NativeWind `@theme` blocks.
  - Malformed or unparseable input yields an empty map (caller degrades to arbitrary hex).
- `main` stores the map in `figma.clientStorage`, then calls `figma.codegen.refresh()`.
- `map-styles`: when a node's hex (lowercased `#rrggbb`) is a key in `colorTokens`, emit `bg-<token>` / `text-<token>`; otherwise keep `bg-[#hex]`.

Success: importing a config with `colors.primary = '#3b82f6'` makes a frame filled `#3B82F6` generate `bg-primary` rather than `bg-[#3b82f6]`.

## C. Repeated-subtree reuse (next)

- `src/core/extract-components.ts` (new, pure): compute a structural hash per IR subtree (type + mapped classes + text + ordered child hashes). Subtrees whose hash repeats ≥2 times and whose size is non-trivial (≥3 nodes) are hoisted into local sub-components; occurrences are replaced with `<NameN/>`. Names derive from the Figma layer name (PascalCase, de-duplicated).
- Baseline extracts only subtrees that are identical including text content (conservative). Lifting differing text into props is future work.
- `generate-rn` emits the hoisted sub-component functions plus the main component, all in one file. Generated sub-components are `View`/`Text` compositions, so `className` works without NativeWind `cssInterop`.

Success: a list of 5 identical card subtrees generates one `Card()` sub-component referenced 5 times.

## Module boundaries

| File                             | Change                                                         | Purity |
| -------------------------------- | -------------------------------------------------------------- | ------ |
| `src/core/options.ts`            | new — `GenOptions`                                             | pure   |
| `src/core/parse-theme.ts`        | new — theme → hex/token map (B)                                | pure   |
| `src/core/extract-components.ts` | new — repeated-subtree hoist (C)                               | pure   |
| `src/core/map-styles.ts`         | accept `colorTokens` for token mapping (B)                     | pure   |
| `src/core/generate-rn.ts`        | accept `GenOptions`; emit sub-components (C)                   | pure   |
| `src/main.ts`                    | read preferences/clientStorage; `preferenceschange` → `showUI` | figma  |
| `src/import-ui.tsx`              | new — import iframe (B)                                        | preact |
| `package.json` `figma-plugin`    | `codegenPreferences` (A + action for B)                        | —      |

## Testing

- A: extend existing tests to assert `Loose`/`Strict` tolerance changes snapping.
- B: `parse-theme` unit tests — tailwind object literal (flat + one-level nested), CSS `--color-*` / `@theme`, and malformed input → empty map.
- C: `extract-components` unit tests — repeated subtree hoisted and referenced; non-trivial-size threshold respected; differing-text subtrees not merged.

Minimum verification per increment: `pnpm build && pnpm test && pnpm lint`.

## Risks / open questions

- Tailwind config parsing is best-effort by design; we never execute the file. Document the supported subset (static color literals) in the import UI so expectations are clear.
- `SCALED` unit handling depends on `scaleFactor`; verify against a real Dev Mode session.
- Component-extraction naming collisions across distinct subtrees are resolved by numeric suffixes.
