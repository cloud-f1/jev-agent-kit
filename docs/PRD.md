# PRD: Jev Agent Kit

Status: v0.3.0 (branch `v0.3.0`, unreleased); last release v0.2.1 (see [CHANGELOG.md](../CHANGELOG.md)). Epics and their state: [EPICS.md](EPICS.md). Verified vs not: [compatibility.md](compatibility.md).

## Problem

Long Bash output (test runs, builds, logs) fills an agent's context. Most of it is noise, but a little of it is the evidence the agent needs. Cutting it blindly risks dropping that evidence and making the agent fail or retry, which costs more than it saves.

## Product

An unofficial Claude Code plugin (MIT, not affiliated with TypeSafe AI) that shortens long Bash output before the model sees it, always keeping the untouched original recoverable. One native TypeScript Mod; Python is only the optional maintainer/evaluation CLI and the parity reference.

## Users

- Claude Code users who run long commands and want smaller context without losing errors.
- Maintainers who need evidence, not claims, about whether pruning helps.

## Goals

1. Shorter Bash output in `assist` mode: keep head, tail and every error/warning/traceback block (plus neighbours); optionally let Jev score the rest.
2. Safe by construction: any failure returns the original output.
3. Recoverable: the original is stored (`0600`) and `/jev readback <id>` returns it.
4. Honest: no savings claim without paired agent-task evidence.
5. Opt-in per project; zero setup beyond `/config`.

## Non-goals

- Whole-session compaction (a different, larger lever; see fast-jev-compaction in [sources.md](sources.md)).
- Being a security control or a secret scanner.
- Letting the model decide whether to prune (quicksilver's approach; see sources.md).
- Hosted services, telemetry, or any endpoint other than the fixed Jev one.

## Requirements

Functional
- F1. Wrap Bash results; rewrite only `stdout` of successful, non-interrupted, non-image results.
- F2. `observe` (record only) and `assist` (rewrite) modes; `rules` (local) and `jev` backends.
- F3. `/jev status | doctor | readback <id> | on | off | mode | init` without a model turn. A read-back pauses rewriting for the session.
- F4. Settings in `/config` (mode, backend, minimum length, keep threshold, retention, enable-everywhere, model, sensitive key); project file `.claude/jev-agent-kit.json` for per-project overrides.
- F5. Failures visible: one toast per fixed reason code per session, a debug-log line per decision.
- F6. Key lookup: env, plugin secure setting, user `settings.json` env, `JEV_ENV_FILE`. Never from a project.

Safety (each has tests; do not weaken)
- S1. Never rewrite `stderr`, interrupted, image, failed or denied results.
- S2. Error-bearing blocks are never dropped, with or without Jev.
- S3. Records and logs hold only fixed reason codes: no keys, response bodies, exception text, code, prompts or full logs.
- S4. The goal text is redacted before leaving the machine; fixed endpoint; a project cannot set endpoint, key, credential paths or model.
- S5. A pinned model must answer as itself, else the original is kept.

Quality
- Q1. TypeScript and Python cores agree on a shared golden fixture.
- Q2. Local release gate (`scripts/release_check.py`) must pass; there is no CI.

## Success metrics

Mechanism (measured): pruned length, errors preserved, fail-open on every injected failure. Today: a 30,000-character log became 570 in a real session; 58 Python + 91 Mod/core tests pass.

Benefit (not measured): total cost per successful agent task, success rate, read-back rate. Defined in [EVALUATION.md](EVALUATION.md). Until that paired benchmark runs the status stays "mechanism works, benefit unproven".

## Risks

| Risk | Mitigation / state |
|---|---|
| Pruning drops needed evidence | Errors pinned; read-back; evidence-survival check on the backlog |
| Live Jev behaviour differs from the stubs | Live smoke test; every Jev path was stub-tested only until then |
| Windows branch is wrong | Stubbed tests only; needs a real Windows run |
| Claude Code mods API changes | `any` types hide drift until runtime; optional `tsc` check on the backlog |
| Key exposure | Key only in the request header; never recorded; user-level sources only |
| Over-claiming | Project rule: say exactly what ran; no savings claims |

## Open questions

1. Does Jev pruning beat the local rules backend on cost per successful task? (needs benchmark budget)
2. Are the thresholds (`minimumChars` 8000, `keepThreshold` 0.8) right for non-English or mixed logs?
3. Resolved 2026-10-10: the pinned `jev-1.13.0` answers under that exact name on the live API (one smoke call).
