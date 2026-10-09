# Epics

Derived from [PRD.md](PRD.md). Jira project **JEV** (https://cloud-f1.atlassian.net/browse/JEV, team-managed software, created 2026-10-10) mirrors this file: E1 to E9 are JEV-1 to JEV-9, stories are JEV-10 to JEV-19. Jira status was set from this file once; keep both in step when an epic changes. Status is what has actually run, per [compatibility.md](compatibility.md).

| Epic | Theme | Version | State |
|---|---|---|---|
| E1 (JEV-1) | Core pruning with read-back | 0.1.0 / 0.2.0 | Done; verified in a real session |
| E2 (JEV-2) | Native TypeScript Mod | 0.2.0 | Done; Windows branch unrun |
| E3 (JEV-3) | Settings and `/jev` commands | 0.2.0 | Done; interactive `/config` screen not seen |
| E4 (JEV-4) | Safety and audit | 0.2.0 / 0.2.1 | Two read-only audits done and fixed |
| E5 (JEV-5) | Visibility and Jev model/key handling | 0.2.1 | Released |
| E6 (JEV-6) | Live Jev validation | 0.3.0 | Smoke and synthetic bench passed; `backend: jev` in a real session not run |
| E7 (JEV-7) | Usability (v0.3) | 0.3.0 | Commands, receipt released; `/jev savings`, pane, presets open |
| E8 (JEV-8) | Evidence of benefit | 0.3.0 partial | Needs budget decision |
| E9 (JEV-9) | Platform and maintainability | planned | Not started |

## E1 (JEV-1) Core pruning with read-back (done)
- Head/tail/error-block pruning with neighbours; originals stored `0600`, readback pointer.
- Python reference core; TS core matches via golden fixtures.

## E2 (JEV-2) Native TypeScript Mod (done)
- `hooks/register.ts` is the only file that calls the mods API; classic hooks retired and rejected by the gate.
- Cross-platform code path (stat realPath, `USERPROFILE`, drive/UNC state dirs, PowerShell retention). Windows never run.

## E3 (JEV-3) Settings and commands (done)
- `userConfig` rows in `/config`, sensitive key in secure storage; precedence defaults < plugin < project file.
- `/jev status | doctor | readback`.

## E4 (JEV-4) Safety and audit (done)
- 0.2.0 independent audit: 13 findings fixed (redaction of Bearer/JSON secrets was the high one).
- 0.2.1 read-only audit: project `settings.json` could supply the key (fixed: user source only); pinned model now must answer as itself; internal-error diagnostics logged.
- Residual: `$.http.fetch` may follow redirects (the key is only ever sent to the fixed endpoint).

## E5 (JEV-5) Visibility and key/model handling (released in 0.2.1)
- Once-per-reason toast + debug log; key from user `settings.json` env; `Jev model` setting with `requested_model` / `actual_model` records.
- Not tested: a real compaction with fast-jev-compaction active.

## E6 (JEV-6) Live Jev validation (next)
- S6.1 (JEV-10) Done 2026-10-10: `jev.py smoke` returned `api_validated`.
- S6.2 (JEV-11) Done: the pinned model answered as `jev-1.13.0`.
- S6.3 (JEV-12) Done 2026-10-10: `bench-logs --live`, 5/5 valid decisions (synthetic planted-evidence proxy, not agent-task evidence).

## E7 (JEV-7) Usability (planned, v0.3)
- Built in 0.3.0 (JEV-13): `/jev on|off|mode` via `$.config.set`, `/jev init`.
- Open: `/jev savings` (what `assist` would have saved, from `observe` data); optional pane; presets.

## E8 (JEV-8) Evidence of benefit (planned)
- Paired agent-task benchmark (10 to 20 smoke tasks, then 100+) per EVALUATION.md, with ground truth, baseline arm and negative control (layout idea from quicksilver).
- (JEV-15, built in 0.3.0) Shadow mode = `observe` + `jev` (documented, tested); stop pruning after a read-back. Evidence-survival check: error blocks are pinned by construction and tested.
- (JEV-16, built in 0.3.0) Receipt line with measured counts only; no "tokens saved" counter.

## E9 (JEV-9) Platform and maintainability (planned)
- Test the Mod on a real Windows machine and fix what breaks.
- (JEV-18, built in 0.3.0: script + typed `register`; `$: any` helpers remain) Optional `tsc` type-check against Claude Code's `claude-code.d.ts` (maintainers only, outside the release gate).
- Collapse repeated lines that differ only in numbers or ids (change both cores, regenerate golden).
