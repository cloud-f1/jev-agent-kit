# Compatibility and verification status

Updated 2026-10-10 (v0.6.5). Records what was actually run and what was not. No CI exists; every row below was run locally.

Environment: macOS arm64, Node 22.22, Claude Code 2.1.296.

| Item | Status | Evidence |
|---|---|---|
| Node CLI, state, metrics, release gate | Passed | 40 tests, `node --test cli/tests/*.spec.ts` |
| Coexistence with fast-jev-compaction (MIT, other mod) | Passed at load + tool.call | `claude -p` with both `--plugin-dir`: both modules loaded, none skipped, our pruning ran. A real compaction with both active was **not** tested |
| Plugin settings (`userConfig`) in a real session | Partly | `claude -p "/jev doctor"` shows the defaults filled in and their source; the `/config` screen itself and the sensitive-key prompt are interactive and **not yet seen** |
| TypeScript core + Mod (stubbed host) | Passed | 109 tests, `claude plugin test` |
| Type-check (`npm run typecheck`) | Passed | two `tsc` projects, 0 errors; `$` is `EngineInterface`; a deliberate typo fails to compile |
| Core vs frozen golden fixture | Passed | 14+5 prune cases, 7 redaction cases, 3 digests, 10 settings merges (generated from the retired Python core); `node scripts/gen-golden.ts` fails on drift |
| Python vs TypeScript CLI differential (0.5.0, one time) | Passed | 178 comparisons, 0 differences after ignoring float noise; Python removed afterwards |
| Tests detect regressions | Spot-checked | two deliberate bugs (assist never rewrites; key leaked into a record) each failed the suite |
| `claude plugin validate --strict` | Passed | manifests, hooks, Mod static analysis |
| Classic hook in a real session | Passed (v0.1.0) | debug log: `Hook PostToolUse ... replaced tool output` |
| Independent audit | Done, 13 findings, all fixed | read-only reviewer; see CHANGELOG 0.2.0. Re-verified live after the fixes (files 0600, dirs 0700, same project hash as the old Python core). One more read-only audit per release since, none with an unfixed high finding |
| Native Mod in a real session | Passed | `claude -p` + `--model haiku` in a scratch project: module loaded alone, pruned text and the receipt reached the model; eval traces show the receipt naming a readable file and the model reading it |
| `/jev doctor`, `/jev status` | Passed live | `claude -p "/jev doctor"` |
| `/jev readback <id>` | Tested with stubs only | not run live |
| Install from the GitHub marketplace | Passed for 0.2.0, 0.2.1, 0.3.0, 0.4.0, 0.5.0, 0.6.0 and 0.6.1 | `marketplace add`, `install`/`update` in a scratch project; `claude -p "/jev doctor"` ran from the installed copy. Install prints `8 userConfig options not yet set` (all optional). The test installs were uninstalled afterwards |
| `/jev preset`, `/jev init`, `/jev savings` in `claude -p` | Passed (2026-10-10) | project file created and read back by `/jev doctor` |
| `/jev on|off|mode` | Works interactively, not headless | interactive (expect-driven, 2026-10-10): "Set mode = assist (your plugin settings, every project)" and hooks reloaded; note a project file still overrides; headless `claude -p`: no /config row for this plugin |
| `claude plugin eval` paired smoke (4 cases x 8 runs, haiku, local rules) | Passed 32/32 both arms (2026-10-10) | found two real failures first (see CHANGELOG 0.6.0); small synthetic sample: not benefit evidence |
| `/jev pane` in a real interactive session | Passed | opened, drew counted characters from seeded records, closed; narrow terminals not seen |
| Live Jev API `smoke` | Passed once (2026-10-10) | one synthetic sentence; `api_validated`, model `jev-1.13.0` answered as itself |
| Live Jev API `bench-logs --live` | Passed once (2026-10-10) | 5 synthetic 320-line fixtures, 5 of 5 valid decisions |
| `backend: jev` in a real `claude -p` session | Run once (2026-10-10): **Jev was not called** | synthetic 27 KB log (188 blocks) hit `budget_fallback_original` and came back unchanged; limit is 96 candidate blocks / 60 KB per request (about 800 short lines). Under the limit it works: a synthetic 600-line log (10,701 chars) gave `reason: ok`, `actual_model: jev-1.13.0`, 7,563 input tokens (about $0.0003), 10,701 -> 978 chars, no key-like text in the record. Jira JEV-29 |
| Cost or success-rate benefit | **Unproven** | no agent-task benchmark has been run; see `docs/EVALUATION.md` |
| Interactive session | Partly | seen: hot reload on a settings change, `/jev` commands, the pane, the `/config` screen opening. Not seen: the sensitive-key prompt, the status line under the prompt, a narrow terminal (a second scripted attempt for the status line and a narrow pane exited at the trust dialog and was not repeated) |
| Windows | **Written, never run** | Mod has a Windows branch (file-API writes, PowerShell retention, `USERPROFILE`, drive/UNC paths) covered by stubbed tests on macOS only; the PowerShell script and real path behavior are unverified |
| Python hook removed | Verified live | `Registered 0 hooks` in the debug log; Mod ran alone |
| Model routing (`agent.spawn`, `turn.step`) | Not implemented | not planned |

## Behaviors learned the hard way

- `defaultEnabled: false` in `plugin.json`: a `--plugin-dir` load registers neither the module nor the hooks. Do not use it.
- Two plugins named `jev-agent-kit` (installed copy + `--plugin-dir`) in one project: test setups must disable the installed one.
- `$.fs.write` has no file-mode option, so the Mod writes through `sh -c 'umask 077; ... cat > file'` with `stdin`.
- `JSON` files cannot be imported by Mod tests; fixtures are mirrored to `golden.ts`.
- Claude Code writes `.claude-plugin/types/` (and a root `tsconfig.json`) when a mod loads in an **interactive** session, not under `claude -p`; both are git-ignored and `npm run typecheck` needs them.
- Claude Code cuts Bash output at 30,000 characters, keeps the complete text in its own file, and shows the model a preview; the kit leaves output at that cut alone.
- A model cannot run slash commands, so the receipt names a file it can read.

| Tester checklist [`TESTING.md`](TESTING.md) steps 1 to 8 on 0.6.1 | Passed (2026-10-10, headless `claude -p`, fresh folder, installed from the marketplace) | not-opted-in message, preset created then refused to overwrite, observe left the output unchanged, `prune · ok · 27418 → 1063 chars`, assist added the receipt naming the stored file, `/jev savings` matched. Steps 9 to 14 (pane, read-back, 30,000-char cut, restart) were covered by earlier runs, not re-walked on 0.6.1 |

## Manual interactive check

The step-by-step tester checklist is [`TESTING.md`](TESTING.md). The parts below were run by a scripted interactive session on 2026-10-10 (`/jev mode`, `/jev pane`); the sensitive-key prompt and the status line were not seen.
