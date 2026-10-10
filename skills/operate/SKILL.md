---
name: operate
description: Set up, diagnose and explain Jev Agent Kit in a project. Use when the user asks to install or configure jev-agent-kit, check why a Bash log was or was not pruned, read back an original log, switch observe/assist mode, pick a preset, interpret decision records or /jev savings, open the /jev pane, or run the evaluation report.
---

# Operate Jev Agent Kit

Jev Agent Kit shortens long Bash output with a local rules engine, optionally assisted by the Jev model (TypeSafe AI System One). It runs as a **native Mod** (Claude Code 2.1.287+). On older versions the plugin loads but does nothing: tell the user to update. You never need it to work; this skill helps you operate it.

## Commands (they cost no model turn; prefer them)

| Command | Does |
|---|---|
| `/jev doctor [--verify]` | Version, each effective setting and where it comes from, whether a key exists (never the key). `--verify` checks the key with one synthetic sentence (`valid` / `invalid (401|403)` / `missing` / `error (<reason>)`); only run it when the user asks. Plain doctor does not validate the key |
| `/jev status` | Count and last 10 decision records for this project |
| `/jev savings` | Counted characters: what `assist` removed, and what it would have removed in `observe`. Not tokens, cost or success |
| `/jev pane` / `/jev pane close` | Side pane with the same numbers |
| `/jev readback <id>` | The untouched original; also pauses rewriting for this project (see below) |
| `/jev preset <name>` | Create the project file: `observe-local`, `shadow-jev`, `prune-local`, `prune-jev`. Prints what it wrote (read back) and whether data leaves the machine. Never overwrites: if the file exists it prints the current values and says to edit `mode`/`backend` or delete the file first |
| `/jev init [observe\|assist]` | Create the project file (local rules). Never overwrites |
| `/jev on` / `off` / `mode observe\|assist` | Change the user-level plugin settings. **Work in an interactive session only**; headless (`claude -p`) answers "Could not change the setting": use `/config` or `claude plugin configure jev-agent-kit` |

Optional maintainer CLI: `node "${CLAUDE_PLUGIN_ROOT}/cli/jev.ts" <command>` (Node 22.18+, no build).

## Safety rules (always)

- Never ask the user to paste `TYPESAFE_API_KEY`. Never read, print or commit `.env.local`. `/jev doctor` reports only whether a key exists.
- `observe` does not rewrite output, but with `backend: jev` it still sends redacted log blocks to the Jev API and costs money. Say so before enabling it. `backend: rules` sends nothing anywhere.
- Never claim savings. Mock runs, `log_proxy` numbers and the small `evals/` smoke suite are not agent-task evidence; the real benchmark has not been run.
- This is cost optimization, not a security control. Regex redaction is best effort.

## How it decides

1. **Opt-in.** The project needs `.claude/jev-agent-kit.json` with `"enabled": true`, or the user turned on "Enable in every project". Absent = off.
2. **Size window.** Output shorter than `minimumChars` (default 8,000) is never touched. Claude Code itself cuts Bash output at 30,000 characters (`BASH_MAX_OUTPUT_LENGTH`) *before* any hook runs and keeps the complete text in its own file; output at 99% of that cut or more is left alone (record `host_truncated_output`), because the kit would only see a head. So the kit acts between `minimumChars` and about 29,700 characters.
3. **Modes.** `observe` records the decision and stores the original; output unchanged. `assist` replaces `stdout` with the pruned text plus a receipt. `stderr`, interrupted runs, images, failed commands and denied calls are never rewritten.
4. **What pruning keeps.** The head, the tail, every block with an error/warning/traceback word (plus neighbours). One exception: 6 or more consecutive warning-only lines that differ only in digits collapse to the first 2, a `[N similar lines omitted ...]` marker and the last 1. A line with an error-class word, a stack frame or a `File` line is never collapsed.
5. **The receipt** (added in `assist` only). The pruned text ends with `[Jev agent kit: pruned N -> M chars. The full original is in the file <state>/artifacts/<id>.log (read it with your Read tool or cat); the user can run /jev readback <id> ...]`. `<state>` is the project's state directory. **You cannot run slash commands: if you need a line that was omitted, read that file.** A Bash command whose text contains the absolute `<state>/artifacts/` path (or the user running `/jev readback` with a valid id) pauses rewriting in `assist` for this project until Claude Code restarts, and the output of that read is returned whole. Relative paths or `cd` forms do not match and do not pause it. Reading with the Read tool alone does not pause it.
6. **Jev backend limit.** Jev is asked about at most 96 non-pinned blocks (8 lines each) or 60 KB per request. A longer log gets reason `budget_fallback_original`: nothing is sent and the output is unchanged. In practice that is roughly 800 short lines (about 14,000 characters), so with `backend: jev` and the default `minimumChars` the usable window is only about 8,000 to 14,000 characters; a 27 KB log never reaches Jev (known limitation). Seen working once headless (a 600-line synthetic log: `reason: ok`, about $0.0003 of Jev input). `/jev savings` reads only the last 500 records.
7. **Any failure returns the original output.** Look at the record's `reason` (`ok`, `missing_key`, `http_429`, `invalid_model`, `model_mismatch`, `budget_fallback_original`, `host_truncated_output`, `paused_after_readback`, `redaction_unavailable` (nothing was sent: the redaction pass could not run safely, so the original was kept), ...).

## Settings and precedence

Defaults < plugin settings (Configure form, user-wide) < project file `.claude/jev-agent-kit.json`. **A field present in the project file wins over `/jev mode`, `/jev on` and the Configure form.** To change a project's mode, edit the file, or delete it and run `/jev preset <name>`. `/jev doctor` labels every value `project file` or `plugin settings`.

Config fields: `schemaVersion` (1), `enabled`, `mode`, `backend` (`rules`|`jev`), `minimumChars`, `timeoutSeconds`, `keepThreshold`, `retentionDays`. Projects cannot set the endpoint, key, credential paths or model. The key comes from `TYPESAFE_API_KEY`, the plugin's secure setting, the user's `settings.json` env (never a project's), or `JEV_ENV_FILE`. The `Jev model` setting is plugin-level only; a pinned model must answer as itself (else `model_mismatch`), `jev-latest` may resolve to another `jev-*` name.

Rollout: `rules`+`observe` first (`/jev preset observe-local`), then `assist` with `rules`, and only then `jev`, starting with `shadow-jev` (asks Jev, records, never rewrites). Watch `/jev status` and `/jev savings` at each step.

## Diagnosing

| Symptom | Check |
|---|---|
| Nothing happens | `/jev doctor`: is `enabled=true`? `claude --debug-file f.log` and grep `hooks module jev-agent-kit` |
| `/jev` unknown | Mod not loaded: Claude Code older than 2.1.287, `--bare`/`--safe-mode`, or `disableAllHooks` |
| Output not shortened | Under `minimumChars`; `observe` mode; at/over the 30,000-character cut (`host_truncated_output`); rewriting paused after a read-back; or the record shows a fallback `reason` |
| `backend: jev` but no savings on a long log | `budget_fallback_original`: more than 96 candidate blocks (see above) |
| `/jev mode assist` "worked" but nothing changed | The project file's `mode` overrides it: check `/jev doctor` |
| `/jev mode`/`on`/`off`: "Could not change the setting" | Headless session; use `/plugin` → Installed → Jev Agent Kit → Configure, or `claude plugin configure` |
| Need the full log | The file named in the receipt, or `/jev readback <id>` |
| Plugin edits ignored | Installed plugins are cached by version; develop with `--plugin-dir` |
| Two copies of the plugin | An installed copy and a `--plugin-dir` copy share the name; uninstall or disable one |

## Evaluating

Read `docs/EVALUATION.md`. Keep `log_proxy` and `agent_task` separate, always report `jev_vs_local`, and treat incomplete or unknown-cost data as no verdict. Report command: `node "${CLAUDE_PLUGIN_ROOT}/cli/jev.ts" report --manifest ... --records ...`. `evals/` holds four paired `claude plugin eval` cases (always pass `--no-publish`; the default publishes the report to claude.ai): a smoke test for the mechanism, never a benefit claim. A step-by-step tester checklist is `docs/TESTING.md`.
