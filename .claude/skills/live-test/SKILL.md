---
name: live-test
description: Test jev-agent-kit against a real Claude Code, not stubs. Use when verifying a change in a real session, walking the tester checklist, driving the interactive TUI with expect, or running the paired claude-plugin-eval cases. Project-only skill (not shipped to plugin users).
---

# Live-testing jev-agent-kit

Stubbed tests (`claude plugin test`) passed while two real failures existed (a receipt pointing at a slash command the model cannot run; rewriting output that Claude Code had already cut). Only live runs found them. Use the cheapest layer that can show the behavior, and say exactly which layer ran.

## Rules for every layer

- Scratch folder **outside this repo**, `--model haiku`, a throwaway absolute `JEV_STATE_DIR`, and no installed copy of the plugin in that folder (same-name plugins collide).
- Synthetic logs only. Never send real project data to the Jev API; never print, read or commit a key or any `.env*` file.
- Report small samples as smoke, never as a benefit. Always include a case where the needed fact is **not** an error line.
- When a run fails, read the trace before blaming the model or the grader.
- Uninstall every test install afterwards and check `claude plugin list --json` shows no `jev-agent-kit`.

## Layer 1: headless commands and real Bash

```bash
cd <scratch>; export JEV_STATE_DIR=<scratch>/state
claude -p "/jev doctor" --plugin-dir <repo> --model haiku < /dev/null
claude -p "Run exactly this command with the Bash tool ... <cmd>" --plugin-dir <repo> --model haiku --allowedTools "Bash(node:*)" < /dev/null
```

- Put the prompt **before** `--allowedTools`: it takes several values and swallows a following prompt.
- `/jev on|off|mode` fail here by design (no `/config` row headless). `/jev preset|init|doctor|status|savings|pane` work.
- Records are JSON files under `$JEV_STATE_DIR/<hash>/decisions/`; read them to check fixed reason codes and that no key-like text appears.
- Output between 8,000 and ~29,700 characters is what the kit acts on (`node -e` loops of `progress item N` lines: 1,500 lines is ~27 KB). `backend: jev` needs <= 96 candidate blocks (~800 short lines) or it falls back (`budget_fallback_original`).

## Layer 2: paired evals (`claude plugin eval`)

```bash
claude plugin eval . --scaffold --allow-tools Bash,Read --no-publish --max-cost-usd 3 --runs 8 \
  --concurrency 3 --model haiku --trust-plugin --keep-temp --output-dir <scratch>/eval --json <scratch>/eval/out.json < /dev/null
```

- **`--no-publish` always** (default publishes the HTML report to claude.ai). `--scaffold` runs `evals/*/setup.sh` as you; `--allow-tools` and `--trust-plugin` are grants: only for cases and code you wrote. See `evals/README.md`.
- `--keep-temp` keeps each run's `trace.jsonl` (`tracePath` in the JSON): grep it for `Jev agent kit: pruned` to prove the plugin acted in the "with" arm.
- Each run has a throwaway `HOME`, so state stays in the sandbox. Only agent cost is reported; the cases use the local rules backend.
- Four cases: error in a ~17 KB log, warning-heavy ~25 KB, a non-error needle (negative control), and a ~60 KB output past the host cut (regression).

## Layer 3: the interactive TUI with `expect`

Needed for `/jev mode`, `/config`, the pane and the status line. **The harness blocks scripted interactive sessions unless the user has explicitly granted it**; ask, and do not work around a refusal. Once granted, keep it to a scratch folder and fixed, harmless commands.

- `spawn claude --plugin-dir <repo> --model haiku`; `stty rows 50 columns 170 < $spawn_out(slave,name)`.
- Trust prompt: match `Yes,.*trust`, wait ~4 s, send `\033OB` (application-mode down arrow), wait, send `\r`. Pre-approving tools via `.claude/settings.local.json` adds a warning paragraph to that dialog (the one run that used it exited there; the cause was not established, and later runs without it exited too).
- Replace every `sleep` with a draining wait (`expect -re {zzzNEVERzzz}` with a timeout): expect only logs output while an `expect` call runs.
- Type a slash command and its `\r` as two sends with a short wait between.
- Rebuild painted rows from the raw log (turn `ESC[row;colH` into newlines, strip other escapes), then grep.
- Restore any user-level setting you change (`/jev mode observe`).
- Seen working this way: `/jev mode assist` (reloads hooks), `/jev pane` and `/jev pane close`. If the session exits right at the trust dialog (it did in some later runs), stop after one retry and record the item as not verified instead of looping.

## Not verifiable here

The sensitive-key prompt (touches secure storage), the status line under the prompt, a narrow-terminal pane, a real compaction with fast-jev-compaction, Windows. Say so in `docs/compatibility.md`.
