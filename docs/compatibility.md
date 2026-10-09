# Compatibility and verification status

Updated 2026-10-10 (v0.2.0). Records what was actually run and what was not. No CI exists; every row below was run locally.

Environment: macOS arm64, Python 3.14.4, Node (bundled in Claude Code), Claude Code 2.1.295.

| Item | Status | Evidence |
|---|---|---|
| Python core, CLI, classic hook, release gate | Passed | 72 tests, `python3 -m unittest discover -s tests` |
| Python 3.10 to 3.13 | **Not run** | only 3.14.4 tested; stdlib-only code, but unverified |
| TypeScript core + Mod (stubbed host) | Passed | 48 tests, `claude plugin test` |
| TS vs Python parity | Passed | shared golden fixture (14 prune cases incl. CR, Unicode digits, dotless i, emoji; 7 redaction cases; 3 digests); drift test regenerates it from Python |
| Tests detect regressions | Spot-checked | two deliberate bugs (assist never rewrites; key leaked into a record) each failed the suite |
| `claude plugin validate --strict` | Passed | manifests, hooks, Mod static analysis |
| Classic hook in a real session | Passed (v0.1.0) | debug log: `Hook PostToolUse ... replaced tool output` |
| Independent audit | Done, 13 findings, all fixed | read-only reviewer; see CHANGELOG 0.2.0. Re-verified live after the fixes (files 0600, dirs 0700, same project hash as Python) |
| Native Mod in a real session | Passed | `claude -p` + `--model haiku` in a scratch project: module loaded, marker written, classic hook skipped, 30,000 to 570 chars, model quoted the pruned text and the `/jev readback <id>` line |
| `/jev doctor`, `/jev status` | Passed live | `claude -p "/jev doctor"` |
| `/jev readback <id>` | Tested with stubs only | not run live |
| Install from the GitHub marketplace | Passed for v0.1.0 | `marketplace add`, `install`, `enable` in a scratch project. v0.2.0 is not yet pushed/installed |
| Live Jev API (`smoke`, `bench-logs --live`, `backend: jev`) | **Not run** | needs `TYPESAFE_API_KEY`; all Jev paths are tested against stubs only |
| Cost or success-rate benefit | **Unproven** | no agent-task benchmark has been run; see `docs/EVALUATION.md` |
| Interactive session (hot reload, UI status line) | Not run | `$.ui.status` is stubbed in tests |
| Windows | Not supported | Mod writes use `sh` and `umask` |
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
