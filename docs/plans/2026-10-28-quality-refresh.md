# Quality Tooling Refresh Plan

## Work

1. Verify repository identity, instructions, current changes and Oracle precedent.
2. Refresh compatible dependency and linter versions with existing package managers.
3. Run the declared local gates and `trunk check --all --no-fix`.
4. Reconcile affected knowledge and review the scoped candidate.
5. Commit locally and prepare visible evidence before requesting publication approval.

## Success Criteria

1. Resolve Node.js from `.nvmrc` and pnpm from `packageManager` → verify the executable versions and CI declarations.
2. Capture the installed baseline before dependency resolution → verify a typechecked build and retain baseline artifact hashes outside the repository.
3. Refresh the existing lockfile with pnpm → verify `pnpm install --no-frozen-lockfile`, then `pnpm install --frozen-lockfile`.
4. Exercise the resolved dependencies → verify the declared build, test, lint, and typecheck scripts.
5. Preserve the generated contract and guards → compare `figma-plugin`, `manifest.json`, patch, and Vitest configuration with the baseline, and exercise the installed watcher ignore function.
6. Verify the effective Trunk configuration → inspect `trunk config print`, including Pinact commands, runtime versions, security lockfile coverage, and offline TruffleHog flags.
7. Run the full gate → verify `trunk check --all --no-fix --jobs=2` and inspect its actual linter execution and findings.
8. Reconcile knowledge → verify changed documented commands, paths, version sources, and internal links against current files.
9. Verify the local filesystem reader → run its thirteen CLI tests and actual configured encoded/literal failures plus clean success.

Use a deliberate failing input before trusting ad hoc metadata and watcher checks.
Run formatters only with explicit file paths and review the proposed changes before applying them.

## Baseline and Generated Outputs

pnpm 11 verifies dependencies before running scripts and may install when inputs change.
Keep the original-input baseline separate from candidate resolution rather than assuming the first `pnpm build` uses the old graph.
The builder minifies `manifest.json`; format that exact generated file and verify its bytes against the tracked baseline.
Generated JavaScript may differ with esbuild while the source and manifest contract remain unchanged.
Compare the actual compiled codegen callback on a disposable synthetic text node and reject a changed-input control.
Do not use the synthetic check as evidence of real Figma, UI rendering or model integration.

## Declared Gates

- `pnpm install --frozen-lockfile`
- `pnpm build`
- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `trunk check --all --no-fix --jobs=2`

## Source-Line Repair

The current reader uses the independently reviewed `localizations` repair at `b47e59659a886ad673a2f4a9bed6a3bf4986615b`.
It prefers a positive integer filesystem line only when the literal starts on that line.
Invalid hints retain literal-search and file-level fallbacks.
Thirteen CLI tests cover repeated and out-of-order findings in addition to the existing lossless conversion cases.
