# Jev Agent Kit

Shorten long `Bash` output in [Claude Code](https://claude.com/claude-code) before it reaches the model, with a local rules engine and an optional [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev) (TypeSafe AI System One) relevance pass. The original output is always kept and recoverable.

Unofficial community project, not affiliated with TypeSafe AI. MIT licensed.

> **Status: v0.5.0, measured-in-pieces, not proven end to end.** Pruning works in a real Claude Code session (30,000 → 570 characters in one test). Whether it lowers your *total cost per successful task* is **unproven**; run the evaluation in [docs/EVALUATION.md](docs/EVALUATION.md) before relying on it. The live Jev API was exercised once with a synthetic sentence (`smoke`: `api_validated`, model `jev-1.13.0`); the full `backend: jev` pruning path in a real session and `bench-logs --live` have not been run.

## What it does

| Piece | What |
|---|---|
| Native Mod (`hooks/register.ts`) | Wraps Bash tool results. In `assist` mode replaces `stdout` with pruned text + a read-back pointer. Never touches `stderr`, interrupted runs, images, failed or denied calls. |
| `/jev` command + `/config` settings | `/jev status`, `/jev doctor`, `/jev readback <id>` (no model turn spent), and settings rows in `/config`. |
| Operate skill | Teaches Claude to set up, diagnose and explain the kit. |
| CLI (`cli/jev.ts`, Node) | `doctor`, `smoke`, `bench-logs`, `status`, `readback`, `check-config`, `report`. |

Pruning keeps the head, the tail, and every block containing errors/warnings/tracebacks (plus neighbours). One exception, new in 0.4.0: a run of 6 or more consecutive warning lines that differ only in their numbers is shown as the first 2, a `[N similar lines omitted (original lines a-b)]` marker, and the last 1. Any line with an error-class word (error, fail, exception, traceback, assert, expected, actual, timeout, denied, not found, a stack frame or a `File` line) is never collapsed; the full original stays available through `/jev readback`. With `backend: jev`, Jev scores the remaining blocks and keeps relevant ones; error blocks are never up to Jev. Any failure returns the original output.

## Install

Requires **Claude Code 2.1.287 or later** (the Mod). The plugin needs no Python, uv or Node; only the optional maintainer CLI needs Node 22.18+. On 2.1.271 to 2.1.286 it loads but does nothing: update Claude Code.

```
/plugin marketplace add cloud-f1/jev-agent-kit
/plugin install jev-agent-kit --marketplace cloud-f1/jev-agent-kit
```

Or from a shell: `claude plugin marketplace add cloud-f1/jev-agent-kit && claude plugin install jev-agent-kit@jev-agent-kit`.
Local development: `claude --plugin-dir /absolute/path/to/jev-agent-kit`.

Installing changes nothing by itself. **Each project opts in** with a config file.

## Use it: five minutes

Installing changes nothing by itself: a project must be opted in. Two ways, pick one.

### Option A: settings screen (no files)

1. Open `/config` in Claude Code and find the **jev-agent-kit** rows:

   ```text
   Mode                      observe  [observe | assist]
   Backend                   rules    [rules | jev]
   Minimum output length     8000
   Jev keep threshold        0.8
   Keep stored logs (days)   7
   Enable in every project   off
   ```

   (The TypeSafe API key is asked for when you enable the plugin and kept in secure storage; Claude Code does not list sensitive options as `/config` rows. Set it later with `claude plugin configure jev-agent-kit`. This has not yet been seen interactively; see docs/compatibility.md.)
2. Switch **Enable in every project** on. Start with **Mode = observe** and **Backend = rules**: local only, nothing is rewritten, nothing is sent anywhere.
3. Run `/jev doctor` to confirm: every value is listed with where it came from (`plugin settings` or `project file`) and what to do next if the project is not opted in.

### Option B: a file in one project

```bash
mkdir -p .claude && cat > .claude/jev-agent-kit.json <<'JSON'
{"schemaVersion": 1, "enabled": true, "mode": "observe", "backend": "rules"}
JSON
```

The project file always wins over `/config` settings, including `"enabled": false` to opt one repo out while everything else is on.

### Then

4. Run something noisy (a long test run), then `/jev status`. In `observe` the original is stored and the decision logged, but the output is unchanged.
5. Switch Mode to `assist` (in `/config`, or `"mode": "assist"` in the file). The model now sees the pruned text plus `full original available via /jev readback <id>`. `/jev readback <id>` returns everything.
6. Optional, **costs money and sends redacted log blocks to TypeSafe**: set Backend to `jev` and provide a key (below). Watch `/jev status` in `observe` first.

### Settings reference

Precedence: **built-in defaults < plugin settings (`/config`, applies to you everywhere) < project file (`.claude/jev-agent-kit.json`)**. Claude Code fills untouched `/config` rows with their defaults, so `/jev doctor` labels those `plugin settings` too.

| `/config` row | Project-file field | Default | Meaning |
|---|---|---|---|
| Enable in every project | `enabled` | off | Must be on (or the project file must say `true`) or the kit does nothing. |
| Mode | `mode` | observe | `observe` records only; `assist` rewrites output. |
| Backend | `backend` | rules | `rules` is local; `jev` adds the API relevance pass. |
| Minimum output length | `minimumChars` | 8000 | Shorter output is never touched. (Claude Code caps Bash output near 30,000 chars itself.) |
| Jev keep threshold | `keepThreshold` | 0.8 | Probability a non-error block needs for Jev to keep it. |
| Keep stored logs (days) | `retentionDays` | 7 | How long originals and records are kept. |
| Jev model | (settings only) | `jev-1.13.0` | Model requested from TypeSafe. Pinned by default so decisions stay calibrated; set `jev-latest` to follow the newest model (re-check results when it changes). A pinned model must answer as itself (otherwise `model_mismatch` and the original output is kept); `jev-latest` may resolve to any `jev-*` name. A project file cannot set it. `/jev status` records the model that actually answered. |
| (file only) | `timeoutSeconds` | 3 | Jev request deadline; on timeout the original is used. |

Unknown fields in a project file are rejected on purpose: a project cannot set the endpoint, key or credential paths (an untrusted repo must not redirect your key). A bad `/config` value is ignored (the default applies); a bad project file leaves output untouched and `/jev doctor` says why.

### The Jev API key

Get early-access credentials at [console.typesafe.ai](https://console.typesafe.ai). Never paste the key into a chat and never commit it. Lookup order: `TYPESAFE_API_KEY` environment variable, then the plugin's secure setting, then the `env` block of your *user* `settings.json` (a project's own `settings.json` is never used), then a file named by `JEV_ENV_FILE`. `/jev doctor` says which one is in use (never the value).

```bash
# easiest: enter it when Claude Code asks while you enable the plugin (secure storage).
# Skipped it? `claude plugin configure jev-agent-kit` lists unset options and can save values.
# or, from a shell:
cp .env.example .env.local        # edit TYPESAFE_API_KEY=... (gitignored)
export JEV_ENV_FILE=/absolute/path/to/.env.local   # before starting claude
node cli/jev.ts --env-file .env.local smoke   # synthetic text only; exit 3 = no verdict
```

### Where things live

State (originals, decision records) is under `~/.cache/jev-agent-kit/` (override with an absolute `JEV_STATE_DIR`), files `0600`, directories `0700`. Raw logs may contain secrets; redaction is best effort. Records never contain code, prompts, commands, full logs, keys or HTTP bodies.

## The interface

What you can see and touch today, and what is only a plan.

| Surface | Status | What it is |
|---|---|---|
| `/config` rows | **Available** | The settings above, drawn by Claude Code from the plugin manifest (pickers, numbers, a switch). |
| Failure toast | **Available** | If Jev (or pruning) falls back to the original output, a toast says so once per reason per session, with a fixed reason code such as `http_429` or `missing_key`. Nothing from the response is ever shown. |
| Key prompt | **Available** | Asked when you enable the plugin; stored in secure storage. |
| `/jev doctor` | **Available** | Effective config with the source of every value, key presence (never the key), next step. |
| `/jev status` | **Available** | Record count and the last 10 decisions. |
| `/jev readback <id>` | **Available** | Prints the untouched original. |
| Status line under the prompt | **Available** | `jev: 3/5 long logs pruned · 61204 chars saved` (assist) or `jev (observe): 5 long logs seen` (observe). |
| `/jev init`, `/jev on`, `/jev off`, `/jev mode` | Planned (v0.3) | Change settings from the prompt via `$.config.set` instead of opening `/config`. |
| `/jev savings` | Planned (v0.3) | From `observe` data, what `assist` would have saved, so you decide with numbers. |
| A `/jev` pane (tabs: Overview, Recent decisions, Settings) | Idea | A side pane with the same data as `status`/`doctor` and a Select for mode. Claude Code panes support tabs, buttons, inputs and selects, so it is feasible; it is not built. |

## Cross-platform notes

The plugin is one TypeScript Mod: nothing but Claude Code is needed to use it.

| Platform | Status |
|---|---|
| macOS, Linux | Verified (macOS arm64). Private files via `umask 077` (files `0600`, directories `0700`); retention via `find`. |
| Windows | **Code path written, never run on Windows.** Uses the Mod's file API for writes (state lives under your user profile), PowerShell for retention, `USERPROFILE` when `HOME` is unset. Covered by stubbed tests only. Please report what you see. |

Project paths are resolved with the Mod's own file API (`realPath`), so symlinked folders map to the same state on every platform.

**Maintainer and evaluation CLI** (`cli/jev.ts`) is optional and written in TypeScript. Node 22.18 or later runs it directly (type stripping, no build and no dependencies), on macOS, Linux and Windows:

```bash
node cli/jev.ts doctor
node --test cli/tests/*.spec.ts
```

Node refuses to strip types inside `node_modules`, so the CLI runs from a checkout (an `npx` install would need a build step; not provided). Because of the `/config` pickers the plugin needs Claude Code 2.1.271+ to load at all; the Mod needs 2.1.287+.

## Full usage

### In-session commands (Mod)

| Command | Does |
|---|---|
| `/jev doctor` | Version, effective config for this project, whether a key is present (never the key). |
| `/jev status` | Count and the last 10 decision records for this project. |
| `/jev readback <id>` | Print the untouched original output for an id shown at the end of pruned output. Only 32 hex chars are accepted. After a read-back, `assist` stops rewriting for the rest of the session (the model needed the original, so pruning cost something). |
| `/jev on` / `/jev off` / `/jev mode observe\|assist` | Try to change your plugin settings through Claude Code. **Seen live in headless `claude -p`: Claude Code exposes no `/config` row for this plugin there, so these report that and point you to `/config` or `claude plugin configure jev-agent-kit`.** They have not been seen working in an interactive session. |
| `/jev init [observe\|assist]` | Create `.claude/jev-agent-kit.json` for this project (enabled). Never overwrites an existing file. Works in headless runs (seen live). |
| `/jev preset <name>` | Same, from a preset: `observe-local`, `shadow-jev`, `prune-local`, `prune-jev`. `/jev preset` lists them. Seen live. |
| `/jev savings` | Counted characters: what `assist` removed, and what it would have removed in `observe`. Not a token, cost or success measurement. |

Pruned output ends with a measured receipt, e.g. `[Jev agent kit: pruned 30000 -> 570 chars; full original available via /jev readback <id>]`. These are counted characters, not a token or cost claim.

**Shadow mode:** `mode: observe` with `backend: jev` asks Jev about each long log and records what it would have kept, but never rewrites anything. Note this sends (redacted) log blocks to the Jev API even though nothing is changed.

The status line under the prompt shows `jev: N/M long logs pruned · X chars saved` (assist) or `jev (observe): M long logs seen` (observe).

### CLI (`node cli/jev.ts ...` from a checkout; Node 22.18+)

Optional maintainer and evaluation tool; end users do not need it.

| Command | Does | Needs key |
|---|---|---|
| `doctor` | Node version, Claude CLI, key presence, endpoint, model. | no |
| `check-config --project DIR` | Validate `.claude/jev-agent-kit.json`. | no |
| `status --project DIR` | Recent decision records. | no |
| `readback ID --project DIR` | Print a stored original. | no |
| `bench-logs --outdir DIR` | Offline demo on 5 synthetic logs with a mock Jev. **Not** a quality or billing result. | no |
| `smoke` | One synthetic request to the real API; exit 3 = no verdict (missing key, 401, 429, timeout...). | yes |
| `bench-logs --live --outdir DIR` | Same fixtures against the real API (synthetic text only). | yes |
| `report --manifest M --records R --outdir DIR` | Paired agent-task comparison report. | no |

Add `--env-file PATH` before the command to load `TYPESAFE_API_KEY` from a local dotenv file for that run only.

### Several projects

Install the plugin once (user scope). In each repo commit only `.claude/jev-agent-kit.json`; do not copy plugin code. Different repos can use different modes. State is isolated per project directory, so a stored original from one repo is never readable from another.

### Measuring whether it helps

Shorter output is not the goal; lower **cost per successful task** at equal success is. The kit ships the harness, not the answer:

1. Read [docs/EVALUATION.md](docs/EVALUATION.md). Keep the cheap `log_proxy` numbers (characters saved, evidence kept) separate from `agent_task` results.
2. Pre-register tasks in a manifest (`evals/agent-manifest.json` shows the shape), run each task under `baseline`, `local` (rules) and `jev`, several repeats, on identical commits and verifiers.
3. Record one JSON line per run (`evals/agent-record.example.json`), then `node cli/jev.ts report --manifest M --records R`. The bootstrap uses a seeded generator, so its confidence intervals are deterministic but not numerically comparable with reports made by v0.4.x and earlier.
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
| `/jev status` shows a `reason` other than `ok` | That is the fallback cause (`missing_key`, `http_429`, `timeout`, ...); the original was used. The same code appears once as a toast. |
| `http_404` or `invalid_model` after TypeSafe retires a model | Set the Jev model to `jev-latest` in `/config`. |
| Edits to the installed plugin ignored | Installed plugins are cached by version; develop with `--plugin-dir`. |

## Develop and verify

```bash
node --test cli/tests/*.spec.ts            # CLI, state, metrics and release-gate tests (Node 22.18+)
claude plugin test                         # TypeScript core + Mod tests, offline
claude plugin validate --strict .
node cli/jev.ts bench-logs --outdir results/offline   # mock demo, NOT a quality or billing result
node scripts/release-check.ts              # the local release gate (add --release to tag)
```

Optional type-check of `hooks/` and `core/` against Claude Code's own type file (needs `typescript`; not part of the gate): Claude Code writes `.claude-plugin/types/` and a `tsconfig.json` itself when a mod loads interactively, then `CLAUDE_CODE_TYPES=.claude-plugin/types/claude-code.d.ts sh scripts/typecheck.sh`.

Layout: `core/` pure TypeScript (no mods API), `hooks/register.ts` the only file that talks to Claude Code, `cli/` the Node maintainer CLI (it imports the same core), `tests/fixtures/golden.ts` the frozen behavior contract. See [CLAUDE.md](CLAUDE.md) and [docs/HANDOVER.md](docs/HANDOVER.md). Verified vs not-run: [docs/compatibility.md](docs/compatibility.md). Original v0.1 Chinese README: [docs/README.v0.1.zh-TW.md](docs/README.v0.1.zh-TW.md).

## Using it with other Jev mods

Works alongside [fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) (MIT, whole-conversation compaction). They hook different events (ours: `tool.call`; theirs: `session.compact`, `turn.complete`), and loading both in a real session worked: both modules loaded, no hook was skipped, and our pruning ran. **Not tested:** an actual compaction with both active (it needs a Jev key and a long session). Install them separately; neither depends on the other.

## Limits

Not a security control. Not proven to save money. The loop detector only observes. Windows is untested (see Cross-platform notes). Jev is early access and English-first; evaluate Chinese or mixed code/prose logs separately.
