# Plan: align everything on Node and TypeScript

Decision (user, 2026-10-10): drop Python entirely; run the CLI from a checkout; allow `typescript` as an optional dev-only dependency for type-checking; verify interactively with a pinned `expect` script. Status: executed in 0.5.0 (Jira epic JEV-21 and stories).

## Why

The plugin was already TypeScript. Python existed as the reference implementation, the maintainer CLI, the release gate and 60 tests, so every change to pruning or validation had to be made twice and kept byte-identical.

## Facts that shaped the plan

- Node 22.18+ runs `.ts` files directly (type stripping), so no build step. The code already used `.ts` imports and `import type`.
- Node refuses to strip types inside `node_modules`, so an `npx github:...` install of a TypeScript CLI would fail without a build step. The CLI is maintainer-only, so it runs from a checkout.
- `claude plugin test` runs every `*.test.ts` under the folder, so Node-only tests are named `*.spec.ts` under `cli/tests/` and run with `node --test`.
- Claude Code writes its own type file and a `tsconfig.json` when a mod loads interactively; the optional type-check can use them.

## Phases and outcome

| Phase | Work | Result |
|---|---|---|
| 0 Freeze | Tag `v0.4.0` is the last Python version. `tests/fixtures/golden.ts` (generated from Python) is the frozen contract. | Done |
| 1 Tooling | `package.json` (private, ESM, Node >=22.18, no dependencies). | Done |
| 2 CLI | `cli/jev.ts`, `cli/io.ts`, `cli/metrics.ts` port doctor, smoke, bench-logs, status, readback, check-config, report. One shared core. | Done; live `smoke` returned `api_validated` |
| 3 Gate | `scripts/release-check.ts`, `scripts/gen-golden.ts` (check by default, `--write` to regenerate). Version places: 3 plus the CHANGELOG heading. | Done |
| 4 Prove | Differential run of the old Python CLI against the new one before deleting Python: 178 comparisons. | 0 differences after ignoring float noise |
| 5 Docs and release | README, CLAUDE.md, skills, handover, PRD, epics, changelog; 0.5.0. | Done |
| 6 Optional | Real types instead of `$: any`; optional `typescript` devDependency. | Open |

## Trade-offs accepted

- The independent second implementation is gone. Replacements: the frozen golden fixture, `gen-golden.ts` failing on drift, and the one-time differential.
- Bootstrap confidence intervals in `report` use a seeded JavaScript generator: deterministic, but not numerically comparable with Python-era reports.
- No `uvx` install.

## Testing approach (what runs where)

| Layer | How | Proves |
|---|---|---|
| Logic and invariants | `claude plugin test`, `node --test` | Core, Mod, CLI, gate behave as specified (stubs for the host) |
| Real Mod, headless | `claude -p --plugin-dir . "/jev ..."` | Commands, project file, settings layering in a real session |
| Real Mod, interactive | pinned `expect` script in a scratch folder | `/jev mode` and the `/config` screen in a real TUI |
| Evidence of benefit | `claude plugin eval` with its no-plugin baseline arm (not yet used) | The paired benchmark (JEV-14) |
