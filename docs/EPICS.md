# Epics

Derived from [PRD.md](PRD.md); the tester checklist is [TESTING.md](TESTING.md). Jira project **JEV** (https://cloud-f1.atlassian.net/browse/JEV, team-managed software, created 2026-10-10) mirrors this file: E1 to E9 are JEV-1 to JEV-9, stories are JEV-10 to JEV-19. Jira status was set from this file once; keep both in step when an epic changes. Status is what has actually run, per [compatibility.md](compatibility.md).

| Epic | Theme | Version | State |
|---|---|---|---|
| E1 (JEV-1) | Core pruning with read-back | 0.1.0 / 0.2.0 | Done; verified in a real session |
| E2 (JEV-2) | Native TypeScript Mod | 0.2.0 | Done; Windows branch unrun |
| E3 (JEV-3) | Settings and `/jev` commands | 0.2.0 | Done; interactive `/config` screen not seen |
| E4 (JEV-4) | Safety and audit | 0.2.0 / 0.2.1 | Two read-only audits done and fixed |
| E5 (JEV-5) | Visibility and Jev model/key handling | 0.2.1 | Released |
| E6 (JEV-6) | Live Jev validation | 0.3.0 | Smoke and synthetic bench passed; `backend: jev` in a real session not run |
| E7 (JEV-7) | Usability | 0.6.5 | Presets, savings, init, receipt, pane released; `/jev on|off|mode` verified interactively |
| E8 (JEV-8) | Evidence of benefit | 0.3.0 partial | Needs budget decision |
| E9 (JEV-9) | Platform and maintainability | 0.5.0 partial | Node + TypeScript only done; Windows run open |
| E10 (JEV-21) | Node + TypeScript alignment | 0.5.0 | Done; see [PLAN-node-ts.md](PLAN-node-ts.md) |

## E1 (JEV-1) Core pruning with read-back (done)
- Head/tail/error-block pruning with neighbours; originals stored `0600`, readback pointer.
- Pure TypeScript core pinned by a frozen golden fixture (generated from the Python reference core, retired in 0.5.0).

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
- S6.1 (JEV-10) Done 2026-10-10: `smoke` returned `api_validated` (Python CLI in 0.3.x; re-verified through the TypeScript CLI in 0.5.0).
- S6.2 (JEV-11) Done: the pinned model answered as `jev-1.13.0`.
- S6.4 (JEV-29) Open: split long logs into several Jev requests. A real `claude -p` session showed `budget_fallback_original` on a 27 KB log, so Jev is never asked above ~96 candidate blocks.
- S6.3 (JEV-12) Done 2026-10-10: `bench-logs --live`, 5/5 valid decisions (synthetic planted-evidence proxy, not agent-task evidence).

## E7 (JEV-7) Usability (Done in Jira; 0.6.5)
- (JEV-32, 0.6.1 to 0.6.5) Patch releases: tester checklist and link check (0.6.1), skills and Jev size-limit docs (0.6.2), settings-path messages (0.6.3), JEV-30/31 (0.6.4), `/jev status` repeat summary and `jev_asked` honesty in status/savings (0.6.5).
- (JEV-31, built and live-checked in 0.6.4) DX: `check-config` shows the source of every value, `doctor --verify` validates the key (`valid` / `invalid (401)` / `missing`), `/jev init` and `/jev preset` read back what they wrote and say how to switch when the file exists, README backend x mode data-flow table.
- Built in 0.3.0 (JEV-13): `/jev on|off|mode` via `$.config.set`, `/jev init`.
- Corrected in 0.4.0: `/jev on|off|mode` do not work in headless runs (no /config row); interactive unverified.
- Built in 0.4.0: `/jev preset`, `/jev savings` (seen live / stubbed).
- Done (JEV-20, 0.6.0): `/jev on|off|mode` verified interactively (0.5.0 session); `/jev pane` built and seen in a real interactive session.

## E8 (JEV-8) Evidence of benefit (planned)
- (JEV-14, partly done in 0.6.0) `evals/` has four paired `claude plugin eval` cases (ground truth by regex, baseline arm, negative control, host-cap regression); the smoke run found and fixed two real failures. Still open: the real benchmark of EVALUATION.md (many more tasks, real repos, the Jev arm) needs a budget decision.
- (JEV-15, built in 0.3.0) Shadow mode = `observe` + `jev` (documented, tested); stop pruning after a read-back. Evidence-survival check: error blocks are pinned by construction and tested.
- (JEV-16, built in 0.3.0) Receipt line with measured counts only; no "tokens saved" counter.

## E9 (JEV-9) Platform and maintainability (planned)
- Test the Mod on a real Windows machine and fix what breaks.
- (JEV-18, built in 0.3.0: script + typed `register`; `$: any` helpers remain) Optional `tsc` type-check against Claude Code's `claude-code.d.ts` (maintainers only, outside the release gate).
- (JEV-19, built in 0.4.0) Collapse repeated warning-only lines differing in digits; error-class lines never collapsed; both cores, golden regenerated.

## E10 (JEV-21) Node + TypeScript alignment (done in 0.5.0; follow-up in 0.6.4)
- (JEV-30, 0.6.4) CLI `--help` / `-h` / `help` (network commands marked), `--version`, `scripts/jev.sh` wrapper for Node 22.6 to 22.17, README commands documented with the flag.
- Port the maintainer CLI, release gate, golden check and tests from Python to Node + TypeScript; one pure core shared by the Mod and the CLI.
- Differential check before deleting Python: 178 comparisons, 0 differences after ignoring float noise.
- Done (JEV-28, 0.6.0): `$` is `EngineInterface`, `typescript` + `@types/node` dev-only, type-check in the gate.
- Open: a built JS bundle if an `npx` install is ever wanted.
