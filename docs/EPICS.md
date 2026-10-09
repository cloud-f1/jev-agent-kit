# Epics

Derived from [PRD.md](PRD.md). IDs are local (`E1`...), not Jira keys; no Jira project exists for this repo. Status is what has actually run, per [compatibility.md](compatibility.md).

| Epic | Theme | Version | State |
|---|---|---|---|
| E1 | Core pruning with read-back | 0.1.0 / 0.2.0 | Done; verified in a real session |
| E2 | Native TypeScript Mod | 0.2.0 | Done; Windows branch unrun |
| E3 | Settings and `/jev` commands | 0.2.0 | Done; interactive `/config` screen not seen |
| E4 | Safety and audit | 0.2.0 / 0.2.1 | Two read-only audits done and fixed |
| E5 | Visibility and Jev model/key handling | 0.2.1 | Built; release pending |
| E6 | Live Jev validation | next | Smoke passed once; session and bench runs not done |
| E7 | Usability (v0.3) | planned | Not started |
| E8 | Evidence of benefit | planned | Needs budget decision |
| E9 | Platform and maintainability | planned | Not started |

## E1 Core pruning with read-back (done)
- Head/tail/error-block pruning with neighbours; originals stored `0600`, readback pointer.
- Python reference core; TS core matches via golden fixtures.

## E2 Native TypeScript Mod (done)
- `hooks/register.ts` is the only file that calls the mods API; classic hooks retired and rejected by the gate.
- Cross-platform code path (stat realPath, `USERPROFILE`, drive/UNC state dirs, PowerShell retention). Windows never run.

## E3 Settings and commands (done)
- `userConfig` rows in `/config`, sensitive key in secure storage; precedence defaults < plugin < project file.
- `/jev status | doctor | readback`.

## E4 Safety and audit (done)
- 0.2.0 independent audit: 13 findings fixed (redaction of Bearer/JSON secrets was the high one).
- 0.2.1 read-only audit: project `settings.json` could supply the key (fixed: user source only); pinned model now must answer as itself; internal-error diagnostics logged.
- Residual: `$.http.fetch` may follow redirects (the key is only ever sent to the fixed endpoint).

## E5 Visibility and key/model handling (built in 0.2.1)
- Once-per-reason toast + debug log; key from user `settings.json` env; `Jev model` setting with `requested_model` / `actual_model` records.
- Not tested: a real compaction with fast-jev-compaction active.

## E6 Live Jev validation (next)
- S6.1 Done 2026-10-10: `jev.py smoke` returned `api_validated`.
- S6.2 Done: the pinned model answered as `jev-1.13.0`.
- S6.3 Optional `bench-logs --live` on synthetic logs.

## E7 Usability (planned, v0.3)
- `/jev on|off|mode` via `$.config.set`; `/jev init`; `/jev savings` (what `assist` would have saved, from `observe` data); optional pane; presets.

## E8 Evidence of benefit (planned)
- Paired agent-task benchmark (10 to 20 smoke tasks, then 100+) per EVALUATION.md, with ground truth, baseline arm and negative control (layout idea from quicksilver).
- Shadow mode for the Jev decision; evidence-survival check; stop pruning after a read-back (sources.md backlog).
- Receipt line with measured counts only; no "tokens saved" counter.

## E9 Platform and maintainability (planned)
- Test the Mod on a real Windows machine and fix what breaks.
- Optional `tsc` type-check against Claude Code's `claude-code.d.ts` (maintainers only, outside the release gate).
- Collapse repeated lines that differ only in numbers or ids (change both cores, regenerate golden).
