# patch-package → pnpm native patch migration

Date: 2026-06-15

## Problem

After migrating the package manager from npm to pnpm, `patch-package` stopped working:

```log
**ERROR** No package-lock.json, npm-shrinkwrap.json, or yarn.lock file.

You must use either npm@>=5, yarn, or npm-shrinkwrap to manage this project's
dependencies.
```

## Root cause

Two independent reasons patch-package is the wrong tool under pnpm:

1. patch-package requires an npm/yarn lockfile to resolve package versions.
   After the migration only `pnpm-lock.yaml` exists, which patch-package 8 does not read.
2. pnpm's `node_modules` is not a flat copy — each package is a **symlink** into the content-addressed `.pnpm` store (e.g. `node_modules/@create-figma-plugin/build -> ../.pnpm/@create-figma-plugin+build@4.0.3_.../node_modules/...`).
   patch-package's git-diff-against-node_modules approach assumes real files in place and does not fit this layout.

## Fix: pnpm native patches

pnpm has a first-class patch workflow that replaces patch-package entirely.

1. Create an editable copy of the package:

   ```bash
   pnpm patch "@create-figma-plugin/build@4.0.3"
   ```

2. Edit the printed temp directory under `node_modules/.pnpm_patches/...`, then commit:

   ```bash
   pnpm patch-commit '/abs/path/to/node_modules/.pnpm_patches/@create-figma-plugin/build@4.0.3'
   ```

   This writes `patches/@create-figma-plugin__build@4.0.3.patch` and registers it in `package.json`:

   ```json
   {
     "pnpm": {
       "patchedDependencies": {
         "@create-figma-plugin/build@4.0.3": "patches/@create-figma-plugin__build@4.0.3.patch"
       }
     }
   }
   ```

3. Remove the patch-package leftovers:
   - delete the `postinstall: patch-package` script
   - `pnpm remove patch-package`

`pnpm install` now applies the patch automatically — no `postinstall` hook needed.

## Gotchas

- **Patch filename changes.** patch-package used `name+version.patch` (`@create-figma-plugin+build+4.0.3.patch`); pnpm uses `name__version.patch` (`@create-figma-plugin__build@4.0.3.patch`).
  The old git-tracked file must be removed when the new one is added.
- **Version pinning matters.** `patchedDependencies` keys on an exact version (`@4.0.3`).
  A dependency bump will silently drop the patch until you re-run `pnpm patch` against the new version, so keep `@create-figma-plugin/build` pinned (already exact in devDependencies) or expect to re-cut the patch on upgrade.
- **pnpm patch starts from a clean copy** out of the store, not the current (already-edited) `node_modules` file.
  Any manual edits sitting in `node_modules` must be re-applied inside the `.pnpm_patches` temp dir before `patch-commit`.

## What the patch does

Adds `^\\.trunk`, `^\\.remember`, and `^\\.claude` to the build watcher's ignore regex in `lib/watch-async/create-watch-ignore-regex.js`, so `build-figma-plugin --watch` does not rebuild on changes under those tooling directories.
This complements the `vitest.config.ts` discovery scoping noted in CLAUDE.md.

## Verification

```bash
pnpm install   # patch applied automatically
pnpm build     # typecheck + build success
pnpm test      # 6 tests passed
```
