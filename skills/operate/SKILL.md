---
name: operate
description: Set up, diagnose and explain Jev Agent Kit in a project. Use when the user asks to install or configure jev-agent-kit, check why a Bash log was or was not pruned, read back an original log, switch observe/assist mode, interpret decision records, or run the evaluation report.
---

# Operate Jev Agent Kit

Jev Agent Kit shortens long Bash output with a local rules engine, optionally assisted by the Jev model (TypeSafe AI System One). It runs as a **native Mod** (Claude Code 2.1.287+). On older versions the plugin loads but does nothing: tell the user to update. It is never required for you to work; this skill helps you operate it.

Optional maintainer/eval CLI: `node "${CLAUDE_PLUGIN_ROOT}/cli/jev.ts" <command>` (Node 22.18+; it runs the TypeScript directly, no build). In-session: `/jev status | doctor | readback <id>` (these cost no model turn; prefer them).

## Safety rules (always)

- Never ask the user to paste `TYPESAFE_API_KEY`. Never read, print or commit `.env.local`. `/jev doctor` reports only whether a key exists.
- `observe` does not rewrite output, but with `backend: jev` it still sends redacted log blocks to the Jev API and costs money. Say so before enabling it.
- `backend: rules` sends nothing anywhere.
- Never claim savings from mock or `log_proxy` runs. They are not agent-task evidence.
- This is cost optimization, not a security control. Regex redaction is best effort.

## How it decides

1. Project must have `.claude/jev-agent-kit.json` with `"enabled": true`. Absent file = off.
2. Claude Code already caps Bash output near 30,000 characters before any hook sees it. Output shorter than `minimumChars` is never touched.
3. `observe`: records the decision and stores the original; output unchanged. `assist`: replaces `stdout` with the pruned text plus a read-back line. `stderr`, interrupted runs, images, failed commands and denied calls are never rewritten.
4. Any error returns the original output. Look at the record's `reason` (`ok`, `missing_key`, `http_429`, `budget_fallback_original`, ...).

Config fields: `schemaVersion` (1), `enabled`, `mode` (`observe`|`assist`), `backend` (`rules`|`jev`), `minimumChars`, `timeoutSeconds`, `keepThreshold`, `retentionDays`. Projects cannot set endpoint, key, credential paths or model. The key comes from `TYPESAFE_API_KEY`, the plugin's secure setting, the user's `settings.json` env (never a project's), or `JEV_ENV_FILE`. The `Jev model` setting is plugin-level only. Fallback reason codes you may see include `missing_key`, `http_429`, `invalid_model`, `model_mismatch`, `budget_fallback_original`.

Rollout: `rules`+`observe` first, then `jev`+`observe` and inspect `/jev status`, only then `assist`.

## Diagnosing

| Symptom | Check |
|---|---|
| Nothing happens | `/jev doctor`: is `enabled=true`? `claude --debug-file f.log` and grep `hooks module jev-agent-kit` |
| `/jev` unknown | Mod not loaded: Claude Code older than 2.1.287, `--bare`/`--safe-mode`, or `disableAllHooks` |
| Output not shortened | Under `minimumChars`, `observe` mode, or the record shows a fallback `reason` |
| Need the full log | `/jev readback <id>` (id is printed at the end of pruned output) |
| Plugin edits ignored | Installed plugins are cached by version; develop with `--plugin-dir` |

## Evaluating

Read `docs/EVALUATION.md`. Keep `log_proxy` and `agent_task` separate, always report `jev_vs_local`, and treat incomplete or unknown-cost data as no verdict. Command: `node "${CLAUDE_PLUGIN_ROOT}/cli/jev.ts" report --manifest ... --records ...`.
