# Jev Agent Kit

Shorten long `Bash` output in [Claude Code](https://claude.com/claude-code) before it reaches the model, with a local rules engine and an optional [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev) (TypeSafe AI System One) relevance pass. The original output is always kept and recoverable.

Unofficial community project, not affiliated with TypeSafe AI. MIT licensed.

> **Status: v0.2.0, measured-in-pieces, not proven end to end.** Pruning works in a real Claude Code session (30,000 → 570 characters in one test). Whether it lowers your *total cost per successful task* is **unproven**; run the evaluation in [docs/EVALUATION.md](docs/EVALUATION.md) before relying on it. The live Jev API path has not been run against a real key.

## What it does

| Piece | What |
|---|---|
| Native Mod (`hooks/register.ts`) | Wraps Bash tool results. In `assist` mode replaces `stdout` with pruned text + a read-back pointer. Never touches `stderr`, interrupted runs, images, failed or denied calls. |
| `/jev` command | `/jev status`, `/jev doctor`, `/jev readback <id>`: no model turn spent. |
| Classic hook (`jev.py hook`) | Same job for Claude Code older than 2.1.287. Stays out of sessions the Mod owns. |
| Operate skill | Teaches Claude to set up, diagnose and explain the kit. |
| CLI (`jev.py`) | `doctor`, `smoke`, `bench-logs`, `status`, `readback`, `check-config`, `install`, `report`. |

Pruning keeps the head, the tail, and every block containing errors/warnings/tracebacks (plus neighbours). With `backend: jev`, Jev scores the remaining blocks and keeps relevant ones; error blocks are never up to Jev. Any failure returns the original output.

## Install

Requires Claude Code 2.1.287+ for the Mod (older versions use the classic hook automatically) and `python3` (3.10+) for the classic hook and CLI.

```
/plugin marketplace add cloud-f1/jev-agent-kit
/plugin install jev-agent-kit --marketplace cloud-f1/jev-agent-kit
```

Or from a shell: `claude plugin marketplace add cloud-f1/jev-agent-kit && claude plugin install jev-agent-kit@jev-agent-kit`.
Local development: `claude --plugin-dir /absolute/path/to/jev-agent-kit`.

Installing changes nothing by itself. **Each project opts in** with a config file.

## Use it: five minutes

1. **Opt a project in** (start safe: local rules, observe only, no network):

   ```bash
   mkdir -p .claude && cat > .claude/jev-agent-kit.json <<'JSON'
   {"schemaVersion": 1, "enabled": true, "mode": "observe", "backend": "rules"}
   JSON
   ```

2. Start `claude` in that project and check: `/jev doctor` should show `enabled=true`.
3. Run something noisy (a long test run). Then `/jev status` shows what was recorded. `observe` never rewrites output; it stores the original and logs the decision.
4. Switch to `"mode": "assist"` to let it shorten output. The model sees the pruned text and a line like `full original available via /jev readback <id>`. Run `/jev readback <id>` to get everything back.
5. Optional, **costs money and sends redacted log blocks to TypeSafe**: set `"backend": "jev"` and provide a key (below). Inspect `/jev status` in `observe` first.

### Config reference (`.claude/jev-agent-kit.json`)

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `false` | Must be `true` or the kit does nothing. |
| `mode` | `observe` | `observe` records only; `assist` rewrites output. |
| `backend` | `rules` | `rules` is local; `jev` adds the API relevance pass. |
| `minimumChars` | 8000 | Shorter output is never touched. (Claude Code caps Bash output near 30,000 chars itself.) |
| `timeoutSeconds` | 3 | Jev request deadline; on timeout the original is used. |
| `keepThreshold` | 0.8 | Jev probability needed to keep a non-error block. |
| `retentionDays` | 7 | How long state is kept. |

Unknown fields are rejected on purpose: a project cannot set the endpoint, key or credential paths (an untrusted repo must not redirect your key).

### The Jev API key

Get early-access credentials at [console.typesafe.ai](https://console.typesafe.ai). Never paste the key into a chat and never commit it.

```bash
cp .env.example .env.local        # then edit TYPESAFE_API_KEY=... (gitignored)
export JEV_ENV_FILE=/absolute/path/to/.env.local   # before starting claude
# or: export TYPESAFE_API_KEY=...
python3 jev.py --env-file .env.local smoke          # synthetic text only; exit 3 = no verdict
```

### Where things live

State (originals, decision records) is under `~/.cache/jev-agent-kit/` (override: `JEV_STATE_DIR`), files `0600`. Raw logs may contain secrets; redaction is best effort. Records never contain code, prompts, commands, full logs, keys or HTTP bodies.

## Full usage

### In-session commands (Mod)

| Command | Does |
|---|---|
| `/jev doctor` | Version, effective config for this project, whether a key is present (never the key). |
| `/jev status` | Count and the last 10 decision records for this project. |
| `/jev readback <id>` | Print the untouched original output for an id shown at the end of pruned output. Only 32 hex chars are accepted. |

The status line under the prompt shows `jev: N/M long logs pruned · X chars saved` (assist) or `jev (observe): M long logs seen` (observe).

### CLI (`python3 jev.py ...`, from the plugin or a checkout)

| Command | Does | Needs key |
|---|---|---|
| `doctor` | Python, Claude CLI, key presence, endpoint, model. | no |
| `check-config --project DIR` | Validate `.claude/jev-agent-kit.json`. | no |
| `status --project DIR` | Recent decision records. | no |
| `readback ID --project DIR` | Print a stored original (classic-hook artifacts). | no |
| `bench-logs --outdir DIR` | Offline demo on 5 synthetic logs with a mock Jev. **Not** a quality or billing result. | no |
| `smoke` | One synthetic request to the real API; exit 3 = no verdict (missing key, 401, 429, timeout...). | yes |
| `bench-logs --live --outdir DIR` | Same fixtures against the real API (synthetic text only). | yes |
| `install --project DIR [--backend rules\|jev] [--mode observe\|assist]` | Classic-hook install into `.claude/settings.json` (backs up, idempotent). Only for Claude Code without Mod support; do not combine with the plugin. | no |
| `report --manifest M --records R --outdir DIR` | Paired agent-task comparison report. | no |

Add `--env-file PATH` before the command to load `TYPESAFE_API_KEY` from a local dotenv file for that run only.

### Several projects

Install the plugin once (user scope). In each repo commit only `.claude/jev-agent-kit.json`; do not copy plugin code. Different repos can use different modes. State is isolated per project directory, so a stored original from one repo is never readable from another.

### Measuring whether it helps

Shorter output is not the goal; lower **cost per successful task** at equal success is. The kit ships the harness, not the answer:

1. Read [docs/EVALUATION.md](docs/EVALUATION.md). Keep the cheap `log_proxy` numbers (characters saved, evidence kept) separate from `agent_task` results.
2. Pre-register tasks in a manifest (`evals/agent-manifest.json` shows the shape), run each task under `baseline`, `local` (rules) and `jev`, several repeats, on identical commits and verifiers.
3. Record one JSON line per run (`evals/agent-record.example.json`), then `python3 jev.py report ...`.
4. Compare `jev` against `local`, not only against baseline, so a cheaper-model effect is not credited to Jev. Missing runs, unknown costs or too few tasks give INCOMPLETE / UNKNOWN_COST / INSUFFICIENT_EVIDENCE, never GO. The gate numbers are a product policy you may change, not a proven threshold.

### Upgrade, rollback, uninstall

- Update: `claude plugin update jev-agent-kit` (installed plugins are cached by version, so a fix only arrives with a new version).
- Roll back: reinstall the earlier tag, or remove and re-add the marketplace pinned to it. Project config files stay valid across 0.1 to 0.2 (`schemaVersion` 1).
- Stop using it in one project: set `"enabled": false` (or delete the file). Everywhere: `claude plugin disable jev-agent-kit`, or `claude plugin uninstall jev-agent-kit`.
- Remove stored data: delete `~/.cache/jev-agent-kit/` (or your `JEV_STATE_DIR`). Originals and records live only there.

### Privacy and data flow

| Backend | Leaves your machine? |
|---|---|
| `rules` | Nothing. |
| `jev` | Redacted log blocks (secrets pattern-masked, best effort), the goal text, and your API key go **only** to `https://api.typesafe.ai/v1/systemone`. Output that is too large (over 96 blocks or about 60 KB per request) is not sent; the original is used. |

Decision records hold counts, reason codes, timing, token usage and an artifact id. They never hold code, prompts, commands, full logs, keys, response bodies or exception text. Optionally put a one-line task description in `.claude/jev-goal.txt` to tell Jev what evidence is relevant (it is redacted before sending).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/jev` not found | Mod not loaded: update Claude Code, or check `claude --debug-file f.log` for `hooks module jev-agent-kit`. |
| Nothing is pruned | `/jev doctor` (is `enabled=true`?), output under `minimumChars`, or `observe` mode. |
| `/jev status` shows a `reason` other than `ok` | That is the fallback cause (`missing_key`, `http_429`, `timeout`, ...); the original was used. |
| Edits to the installed plugin ignored | Installed plugins are cached by version; develop with `--plugin-dir`. |
| Both Mod and classic hook seem to run | Do not also run `jev.py install` in the same project. |

## Develop and verify

```bash
python3 -m unittest discover -s tests      # Python core + hook + release-gate tests (72)
claude plugin test                         # TypeScript core + Mod tests (48), offline
claude plugin validate --strict .
python3 jev.py bench-logs --outdir results/offline   # mock demo, NOT a quality or billing result
python3 scripts/release_check.py           # the local release gate (add --release to tag)
```

Layout: `core/` pure TypeScript (no mods API), `hooks/register.ts` the only file that talks to Claude Code, `jevkit/` the Python core, `tests/fixtures/golden.*` shared by both cores. See [CLAUDE.md](CLAUDE.md) and [docs/HANDOVER.md](docs/HANDOVER.md). Verified vs not-run: [docs/compatibility.md](docs/compatibility.md). Original v0.1 Chinese README: [docs/README.v0.1.zh-TW.md](docs/README.v0.1.zh-TW.md).

## Limits

Not a security control. Not proven to save money. The loop detector only observes. Windows: private file modes (`umask`) are not applied by the Mod. Jev is early access and English-first; evaluate Chinese or mixed code/prose logs separately.
