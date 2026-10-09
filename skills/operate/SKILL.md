---
name: operate
description: Set up, diagnose and explain the Jev Agent Kit hooks in a project. Use when the user asks to install or configure jev-agent-kit, check why a Bash log was pruned, read back an original log, switch observe/assist mode, interpret decision records, or run the evaluation report.
---

# Operate Jev Agent Kit

Jev Agent Kit prunes long Bash output (and observes repeated failures) with a local rules engine, optionally assisted by the Jev model (TypeSafe AI System One). This skill guides you through operating it. It is not required for the hooks to run.

Runtime lives in `${CLAUDE_PLUGIN_ROOT}`; run its CLI as `python3 "${CLAUDE_PLUGIN_ROOT}/jev.py" <command>`.

## Safety rules (always)

- Never ask the user to paste `TYPESAFE_API_KEY`. Never read, print or commit `.env.local`. Check only whether the key exists (`doctor` reports `jev_key_present`).
- `observe` mode does not rewrite output, but with `backend: jev` it still sends redacted log blocks to the Jev API and costs money. Say so before enabling it.
- Only `rules` backend with `enabled: false` sends nothing anywhere.
- Do not claim cost savings or "it works" from mock runs. Mock and `log_proxy` results are not agent-task evidence.
- This is cost optimization, not a security control. Regex redaction is best effort.

## Common tasks

| Task | Command |
|---|---|
| Environment check | `doctor` |
| Validate a project's config | `check-config --project <abs path>` |
| Recent decisions for a project | `status --project <abs path>` |
| Recover the full original log | `readback <ARTIFACT_ID> --project <abs path>` (ID is printed at the end of a pruned output) |
| Offline demo (no key, no network) | `bench-logs --outdir results/offline` |
| Live smoke (needs key, synthetic text only) | `--env-file .env.local smoke` |
| Paired agent-task report | `report --manifest evals/agent-manifest.json --records results/agent-runs.jsonl` |

## Project config

`.claude/jev-agent-kit.json` per project. Fields: `schemaVersion` (1), `enabled`, `mode` (`observe` | `assist`), `backend` (`rules` | `jev`), `minimumChars`, `timeoutSeconds`, `keepThreshold`, `retentionDays`. Projects cannot set endpoint, key or credential paths by design.

Recommended rollout: `rules` + `observe` first, then `jev` + `observe` and inspect `status`, and only then `assist`.

## Plugin vs installer: pick one

The plugin's `hooks/hooks.json` and the `install` command both register the same hook. Never use both in one project or the hook runs twice. The plugin ships with `defaultEnabled: false`, so enable it explicitly (`/plugin` or `claude plugin enable jev-agent-kit`).

## Diagnosing "why was this pruned / not pruned"

1. `status` shows recent decision records (`reason`, `backend`, char counts, `artifact_id`).
2. `reason: ok` means the pipeline ran; any other reason (`missing_key`, `http_429`, `budget_fallback_original`, ...) means it fell back to the original output.
3. Output under `minimumChars` is never touched. Failed commands (`PostToolUseFailure`) are observed only, never rewritten.
4. Use `readback` to confirm no evidence was lost; report any loss as a bug.

## Evaluating

Read `docs/EVALUATION.md`. Keep `log_proxy` and `agent_task` results separate. Always report `jev_vs_local` (Jev's increment over the local rules), not just vs baseline. Insufficient, incomplete or unknown-cost data means no verdict.
