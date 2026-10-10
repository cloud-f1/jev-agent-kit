# Compatibility and verification status

Updated 2026-10-10 (v0.2.0). Records what was actually run and what was not. No CI exists; every row below was run locally.

Environment: macOS arm64, Node 22.22, Claude Code 2.1.296.

| Item | Status | Evidence |
|---|---|---|
| Node CLI, state, metrics, release gate | Passed | 38 tests, `node --test cli/tests/*.spec.ts` |
| Coexistence with fast-jev-compaction (MIT, other mod) | Passed at load + tool.call | `claude -p` with both `--plugin-dir`: both modules loaded, none skipped, our pruning ran. A real compaction with both active was **not** tested |
| Plugin settings (`userConfig`) in a real session | Partly | `claude -p "/jev doctor"` shows the defaults filled in and their source; the `/config` screen itself and the sensitive-key prompt are interactive and **not yet seen** |
| TypeScript core + Mod (stubbed host) | Passed | 96 tests, `claude plugin test` |
| Core vs frozen golden fixture | Passed | 14+5 prune cases, 7 redaction cases, 3 digests, 10 settings merges (generated from the retired Python core); `node scripts/gen-golden.ts` fails on drift |
| Python vs TypeScript CLI differential (0.5.0, one time) | Passed | 178 comparisons, 0 differences after ignoring float noise; Python removed afterwards |
| Tests detect regressions | Spot-checked | two deliberate bugs (assist never rewrites; key leaked into a record) each failed the suite |
| `claude plugin validate --strict` | Passed | manifests, hooks, Mod static analysis |
| Classic hook in a real session | Passed (v0.1.0) | debug log: `Hook PostToolUse ... replaced tool output` |
| Independent audit | Done, 13 findings, all fixed | read-only reviewer; see CHANGELOG 0.2.0. Re-verified live after the fixes (files 0600, dirs 0700, same project hash as Python) |
| Native Mod in a real session | Passed | `claude -p` + `--model haiku` in a scratch project: module loaded, marker written, classic hook skipped, 30,000 to 570 chars, model quoted the pruned text and the `/jev readback <id>` line |
| `/jev doctor`, `/jev status` | Passed live | `claude -p "/jev doctor"` |
| `/jev readback <id>` | Tested with stubs only | not run live |
| Install v0.2.0 from the GitHub marketplace | Passed | `marketplace add`, `install` in a clean scratch project; version 0.2.0; `claude -p "/jev doctor"` ran from the installed copy. Install prints `7 userConfig options not yet set` (all optional) |
| `/jev preset`, `/jev init`, `/jev savings` in `claude -p` | Passed (2026-10-10) | project file created and read back by `/jev doctor` |
| `/jev on|off|mode` | Works interactively, not headless | interactive (expect-driven, 2026-10-10): "Set mode=assist" and hooks reloaded; headless `claude -p`: no /config row for this plugin |
| Live Jev API `smoke` | Passed once (2026-10-10) | one synthetic sentence; `api_validated`, model `jev-1.13.0` answered as itself |
| Live Jev API `bench-logs --live` and `backend: jev` in a real session | **Not run** | the pruning path with Jev is tested against stubs only |
| Cost or success-rate benefit | **Unproven** | no agent-task benchmark has been run; see `docs/EVALUATION.md` |
| Interactive session (hot reload, UI status line) | Not run | `$.ui.status` is stubbed in tests |
| Windows | **Written, never run** | Mod has a Windows branch (file-API writes, PowerShell retention, `USERPROFILE`, drive/UNC paths) covered by stubbed tests on macOS only; the PowerShell script and real path behavior are unverified |
| Python hook removed | Verified live | `Registered 0 hooks` in the debug log; Mod ran alone |
| Model routing (`agent.spawn`, `turn.step`) | Not implemented | v0.3 |

## Behaviors learned the hard way

- `defaultEnabled: false` in `plugin.json`: a `--plugin-dir` load registers neither the module nor the hooks. Do not use it.
- Two plugins named `jev-agent-kit` (installed copy + `--plugin-dir`) in one project: test setups must disable the installed one.
- Claude Code truncates Bash output to about 30,000 characters before hooks run; the kit only ever sees the capped text.
- `$.fs.write` has no file-mode option, so the Mod writes through `sh -c 'umask 077; ... cat > file'` with `stdin`.
- `JSON` files cannot be imported by Mod tests; fixtures are mirrored to `golden.ts`.
- `claude -p` does not write `.claude-plugin/types/`; the published `.d.ts` in the Claude Code repo (`mods/types/claude-code.d.ts`) was used as reference and may lag the installed version.

## Manual interactive check (not yet done)

1. In a scratch project with an `enabled: true` config, run `claude --plugin-dir /absolute/path/to/jev-agent-kit`.
2. `/jev doctor`; run a command printing more than `minimumChars`; `/jev status`.
3. Set `mode` to `assist`, repeat, confirm the status line under the prompt updates and `/jev readback <id>` returns the original.
