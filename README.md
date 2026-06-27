# Figma to NativeWind

A Figma plugin that converts a selected design subtree into React Native + NativeWind component code.

Conversion is deterministic by default (rule-based mapping from Figma properties to NativeWind utility classes), with an optional LLM-assisted pass for naming and structure.
The first-class target is React Native (Expo) + NativeWind; a Next.js + Tailwind renderer is a planned extension sharing the same intermediate representation.

See [BLUEPRINT.md](./BLUEPRINT.md) for the full product requirements and architecture.

## Architecture

```log
Figma selection → extract.ts → collapse-vectors.ts → generate-rn.ts → RN + NativeWind code
                                  IR (+ host SVG export)  ├→ map-styles.ts
                                                          ├→ extract-components.ts
                                                          └─(optional)→ llm.ts
```

Everything except `extract.ts` is free of the Figma runtime, so the conversion logic (`map-styles`, `generate-rn`, `collapse-vectors`, `svg-to-jsx`, `extract-components`, `parse-theme`) is unit-tested with plain IR fixtures.
The one deliberate exception: vector SVG export needs the Figma runtime, so the host walks the IR and exports each vector before the pure `svg-to-jsx` transform runs.

The plugin runs as a Dev Mode **code generator** (converts the selection on every change) and also as a classic run-plugin with a preview + copy UI.

## Development

The package manager is **pnpm** (`pnpm install` applies the build patches in `patches/`).

```bash
pnpm install
pnpm watch   # build the plugin in watch mode
pnpm test    # run the unit tests
```

Load the plugin in the Figma desktop app via Plugins → Development → Import plugin from manifest, pointing at the generated `manifest.json`.

## Status

Deterministic pipeline covering Auto Layout, spacing, color, and text (M1), with UI preview/copy and a spacing-snap setting (M2) and an optional LLM cleanup pass (M3).
Also supports vector → react-native-svg conversion, hoisting repeated subtrees into sub-components, and color-token mapping from an imported Tailwind/CSS theme.
A Next.js + Tailwind renderer reusing the IR (M4) is still planned. See the milestones section in [BLUEPRINT.md](./BLUEPRINT.md).
