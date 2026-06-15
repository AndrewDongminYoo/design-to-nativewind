# Figma to NativeWind

A Figma plugin that converts a selected design subtree into React Native + NativeWind component code.

Conversion is deterministic by default (rule-based mapping from Figma properties to NativeWind utility classes), with an optional LLM-assisted pass for naming and structure.
The first-class target is React Native (Expo) + NativeWind; a Next.js + Tailwind renderer is a planned extension sharing the same intermediate representation.

See [BLUEPRINT.md](./BLUEPRINT.md) for the full product requirements and architecture.

## Architecture

```log
Figma selection → extract.ts → IR → map-styles.ts → generate-rn.ts → RN + NativeWind code
                                                                   └─(optional)→ llm.ts
```

The pure core modules (`map-styles`, `generate-rn`, IR helpers) carry the conversion logic and are unit-tested without a Figma runtime.

## Development

```bash
npm install
npm run watch   # build the plugin in watch mode
npm test        # run the unit tests
```

Load the plugin in the Figma desktop app via Plugins → Development → Import plugin from manifest, pointing at the generated `manifest.json`.

## Status

M0 scaffold: IR types, deterministic pipeline skeleton, and a working RN renderer for Auto Layout, spacing, color, and text.
See the milestones section in [BLUEPRINT.md](./BLUEPRINT.md).
