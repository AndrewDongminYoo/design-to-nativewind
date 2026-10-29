# Quality Tooling Refresh

## Approved Scope

Refresh supported dependencies and existing quality tooling.
Preserve public APIs, plugin metadata, the generated manifest contract and repository-specific boundaries.

## Acceptance

- Pinact remains locked to `4.1.1` with `lint` and `upgrade`.
- The full no-fix Trunk scan and declared project gates pass.
- Changed manifests have package-manager-generated lockfiles under repository policy.
- Advisory dispositions have specific evidence and affected knowledge claims are reconciled.

## Compatibility Boundaries

Keep TypeScript `6.0.3` because `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` `8.72.1` require TypeScript `<6.1.0`.
Keep Preact `10.29.8`, the latest release in the existing major.
The [Preact 11 migration guide](https://preactjs.com/guide/v11/upgrade-guide/) moves event types out of `JSX`, while `src/ui.tsx` uses `JSX.TargetedEvent`.
A source migration is outside this refresh.

Preserve the native pnpm patch for `@create-figma-plugin/build@4.0.3`, the `allowBuilds` approval for esbuild, and source-only Vitest discovery.
The build tool still declares esbuild `0.25.1`, which is newer than the first patched version `0.25.0` in [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99).
Remove the global esbuild `^0.28.1` override, then verify the package-manager-resolved graph and actual build before accepting that removal.

Keep all `figma-plugin` metadata and the generated `manifest.json` byte contract unchanged.
Run TruffleHog with `--no-verification --no-update` so local checks do not verify credentials against external services.
Keep decoded findings with the reviewed filesystem SARIF reader and include it in Trunk's copy sandbox through `direct_configs`.
CI runs its ten standard-library CLI regression tests separately from product tests.
Malformed input must fail without a partial clean SARIF result, and messages must omit secret values.

## Precedent

Oracle source commit: `9670d54de3076c5239713f54900c7a855bd18478`.
Its freshness was unverified, so current repository files and package-manager behavior take precedence.

- `wiki/concepts/pnpm-patched-dependencies-vs-patch-package.md` and `wiki/entities/create-figma-plugin.md` support preserving the native build patch and testing its watcher behavior separately from patch application.
- `wiki/entities/figma-to-nativewind.md`, `wiki/sources/figma-to-nativewind--claude.md`, and `raw/sources/figma-to-nativewind/CLAUDE.md` support preserving generated manifest metadata and source-only test discovery.

Current reads confirmed those boundaries.
The documentation correction uses pnpm 11 behavior from the [official pnpm 11 release notes](https://pnpm.io/blog/releases/11.0), rather than repeating the earlier pnpm 10 generalization.

## Publication

Push and PR creation require explicit repository-specific approval.
After approval, continue the requested hosted gates, merge, cleanup and memory recording.
