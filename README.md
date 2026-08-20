# Design to NativeWind

[![Design to NativeWind converts Figma selections into React Native and NativeWind code](https://raw.githubusercontent.com/AndrewDongminYoo/design-to-nativewind/main/docs/assets/readme-hero.png)](https://rn-toolkits.donminzzi.kr/design-to-nativewind)

[![Figma Community](https://img.shields.io/badge/Figma_Community-install-f24e1e?style=flat-square&logo=figma&logoColor=white)](https://www.figma.com/community/plugin/1653684573206075427/design-to-nativewind) [![React Native](https://img.shields.io/badge/output-React_Native-0086aa?style=flat-square&logo=react&logoColor=white)](https://reactnative.dev/) [![NativeWind](https://img.shields.io/badge/styles-NativeWind-38bdf8?style=flat-square)](https://www.nativewind.dev/) [![license](https://img.shields.io/github/license/AndrewDongminYoo/design-to-nativewind?style=flat-square&color=667085)](LICENSE) [![RN Toolkits](https://img.shields.io/badge/docs-RN_Toolkits-c57417?style=flat-square)](https://rn-toolkits.donminzzi.kr/design-to-nativewind)

**Turn a Figma selection into React Native + NativeWind component code.**

[Install from Figma Community](https://www.figma.com/community/plugin/1653684573206075427/design-to-nativewind) · [Documentation](https://rn-toolkits.donminzzi.kr/design-to-nativewind) · [Issues](https://github.com/AndrewDongminYoo/design-to-nativewind/issues)

Design to NativeWind converts the selected Figma subtree through a deterministic, rule-based pipeline and returns component code ready to inspect and copy.

## What it converts

- Auto Layout, spacing, color, and text properties into NativeWind utility classes
- Vector nodes into `react-native-svg` components
- Repeated subtrees into reusable child components
- Imported Tailwind or CSS colors into project tokens
- Optional LLM-assisted naming and structure cleanup after deterministic generation

The first-class target is React Native with Expo and NativeWind.
A Next.js + Tailwind renderer is a planned extension sharing the same intermediate representation.

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

Install the published plugin from [Figma Community](https://www.figma.com/community/plugin/1653684573206075427/design-to-nativewind).

For local development, use **pnpm** (`pnpm install` applies the build patches in `patches/`).

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
