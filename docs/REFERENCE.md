# Reference

The full detail behind the [README](../README.md): how pruning works, every setting, every command, the CLI, privacy, evaluation, cross-platform notes and development. The README keeps only what you need to install and try it.

## How pruning works

The kit acts on Bash output between `minimumChars` and about 29,700 characters (assuming the default 30,000-character cap, or 99% of `BASH_MAX_OUTPUT_LENGTH` if it is set in the environment): Claude Code itself cuts output at that cap (and keeps the complete text in its own file) before any hook runs, so output at that cut is left alone. With `backend: jev`, Jev is asked about at most 96 non-pinned blocks (8 lines each) and 60 KB per request. A longer log is **not sent at all** and comes back unchanged (record reason `budget_fallback_original`). In practice that is roughly 800 short lines, about 14,000 characters, so a 27 KB log never reaches Jev (found in a real session; tracked as Jira JEV-29). Pruning keeps the head, the tail, and every block containing errors/warnings/tracebacks (plus neighbours). One exception, new in 0.4.0: a run of 6 or more consecutive warning lines that differ only in their numbers is shown as the first 2, a `[N similar lines omitted (original lines a-b)]` marker, and the last 1. Any line with an error-class word (error, fail, exception, traceback, assert, expected, actual, timeout, denied, not found, a stack frame or a `File` line) is never collapsed; the full original stays available through `/jev readback`. With `backend: jev`, Jev scores the remaining blocks and keeps relevant ones; error blocks are never up to Jev. Any failure returns the original output.

## Settings, key and storage

### Settings reference

Precedence: **built-in defaults < plugin settings (the Configure form, applies to you everywhere) < project file (`.claude/jev-agent-kit.json`)**. Claude Code fills untouched settings with their defaults, so `/jev doctor` labels those `plugin settings` too.

| Configure form row | Project-file field | Default | Meaning |
|---|---|---|---|
| Enable in every project | `enabled` | off | Must be on (or the project file must say `true`) or the kit does nothing. |
| Mode | `mode` | observe | `observe` records only; `assist` rewrites output. |
| Backend | `backend` | rules | `rules` is local; `jev` adds the API relevance pass. |
| Minimum output length | `minimumChars` | 8000 | Shorter output is never touched. (Claude Code caps Bash output near 30,000 chars itself.) |
| Jev keep threshold | `keepThreshold` | 0.8 | Probability a non-error block needs for Jev to keep it. |
| Keep stored logs (days) | `retentionDays` | 7 | How long originals and records are kept. |
| Jev model | (settings only) | `jev-1.13.0` | Model requested from TypeSafe. Pinned by default so decisions stay calibrated; set `jev-latest` to follow the newest model (re-check results when it changes). A pinned model must answer as itself (otherwise `model_mismatch` and the original output is kept); `jev-latest` may resolve to any `jev-*` name. A project file cannot set it. `/jev status` records the model that actually answered. |
| (file only) | `timeoutSeconds` | 3 | Jev request deadline; on timeout the original is used. |

Unknown fields in a project file are rejected on purpose: a project cannot set the endpoint, key or credential paths (an untrusted repo must not redirect your key). A bad plugin-setting value is ignored (the default applies); a bad project file leaves output untouched and `/jev doctor` says why.

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

What you can see and touch today.

| Surface | Status | What it is |
|---|---|---|
| Settings form | **Available** | The settings above, drawn by Claude Code from the plugin manifest (pickers, numbers, a switch): `/plugin` → Installed → Jev Agent Kit → Configure. |
| Failure toast | **Available** | If Jev (or pruning) falls back to the original output, a toast says so once per reason per session, with a fixed reason code such as `http_429` or `missing_key`. Nothing from the response is ever shown. |
| Key prompt | **Available** | Asked when you enable the plugin; stored in secure storage. |
| `/jev doctor [--verify]` | **Available** | Effective config with the source of every value, key presence (never the key), next step. `--verify` sends one synthetic sentence and prints `valid`, `invalid (401)`, `missing` or `error (<reason>)`. |
| `/jev status` | **Available** | Record count, the last 10 real decisions, and one line summarizing failed-command repeats. |
| `/jev readback <id>` | **Available** | Prints the untouched original. |
| Status line under the prompt | **Available** | `jev: 3/5 long logs pruned · 61204 chars saved` (assist) or `jev (observe): 5 long logs seen` (observe). |
| `/jev init`, `/jev preset`, `/jev on`, `/jev off`, `/jev mode` | **Available** | Change settings from the prompt via `$.config.set`; interactive sessions only. |
| `/jev pane` / `/jev pane close` | **Available** | Open or close a side pane with the same counted characters and recent decisions as `/jev savings` and `/jev status` (refreshes at most every 3 s). On a narrow terminal it waits until the terminal widens. Seen working in a real interactive session. |
| `/jev savings` | **Available** | Counted characters: what `assist` removed, what it would have removed in `observe`, and how many `backend: jev` logs Jev really answered versus ones the local rules handled alone. |

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
| `/jev doctor` | Version, effective config for this project, whether a key is present (never the key); offline. |
| `/jev doctor --verify` | The same, plus one synthetic request to `api.typesafe.ai` that checks the key (`valid`, `invalid (401)`, `missing`, `error (<reason>)`). The only in-session command that makes a network call besides the Jev pruning itself, and only when you type it. |
| `/jev status` | Count and the last 10 decision records for this project. |
| `/jev readback <id>` | Print the untouched original output for an id shown at the end of pruned output (the same text is in the file named there). Only 32 hex chars are accepted. After a read-back (this command, or any Bash command that mentions the stored artifacts folder), `assist` stops rewriting in that project for the rest of the session (the model needed the original, so pruning cost something). |
| `/jev on` / `/jev off` / `/jev mode observe\|assist` | Try to change your plugin settings through Claude Code. **Work in an interactive session** (seen working in 0.5.0). In headless `claude -p` Claude Code exposes no settings row for this plugin, so they report that and point you to `/plugin` → Installed → Jev Agent Kit → Configure or `claude plugin configure jev-agent-kit`. |
| `/jev init [observe\|assist]` | Create `.claude/jev-agent-kit.json` for this project (enabled). Never overwrites an existing file. Works in headless runs (seen live). |
| `/jev preset <name>` | Same, from a preset: `observe-local`, `shadow-jev`, `prune-local`, `prune-jev`. `/jev preset` lists them. Seen live. |
| `/jev savings` | Counted characters: what `assist` removed, and what it would have removed in `observe`. Not a token, cost or success measurement. |

Pruned output ends with a measured receipt, e.g. `[Jev agent kit: pruned 12000 -> 570 chars. The full original is in the file <state>/artifacts/<id>.log (read it with your Read tool or cat); the user can run /jev readback <id>]` (the path shown to the model is your own state folder, so it contains your home path). These are counted characters, not a token or cost claim.

**Shadow mode:** `mode: observe` with `backend: jev` asks Jev about each long log and records what it would have kept, but never rewrites anything. Note this sends (redacted) log blocks to the Jev API even though nothing is changed.

The status line under the prompt shows `jev: N/M long logs pruned · X chars saved` (assist) or `jev (observe): M long logs seen` (observe).

### CLI (`node cli/jev.ts ...` from a checkout; Node 22.18+)

Optional maintainer and evaluation tool; end users do not need it.

| Command | Does | Needs key |
|---|---|---|
| `doctor` | Node version, Claude CLI, key presence, endpoint, model. Offline. | no |
| `doctor --verify` | Same, plus one synthetic request that reports `key_check`: `valid`, `invalid (401)`, `missing` or `error (<reason>)`. Exit 3 unless `valid`. | yes |
| `check-config --project DIR` | Validate `.claude/jev-agent-kit.json` and print the effective config with a `sources` map (default, plugin settings, project file). | no |
| `status --project DIR` | Recent decision records. | no |
| `readback ID --project DIR` | Print a stored original. | no |
| `bench-logs --outdir DIR` | Offline demo on 5 synthetic logs with a mock Jev. **Not** a quality or billing result. | no |
| `smoke` | One synthetic request to the real API; exit 3 = no verdict (missing key, 401, 429, timeout...). | yes |
| `bench-logs --live --outdir DIR` | Same fixtures against the real API (synthetic text only). | yes |
| `report --manifest M --records R --outdir DIR` | Paired agent-task comparison report. | no |

`node cli/jev.ts --help` (also `-h`, `help`) lists every command and marks the ones that use the network. On Node 22.6 to 22.17 run `sh scripts/jev.sh <command>` (or `npm run jev -- <command>`), which adds `--experimental-strip-types` for you.

Add `--env-file PATH` before the command to load `TYPESAFE_API_KEY` from a local dotenv file for that run only.

### Several projects

Install the plugin once (user scope). In each repo commit only `.claude/jev-agent-kit.json`; do not copy plugin code. Different repos can use different modes. State is isolated per project directory, so a stored original from one repo is never readable from another.

### Measuring whether it helps

Shorter output is not the goal; lower **cost per successful task** at equal success is. The kit ships the harness, not the answer:

1. Read [docs/EVALUATION.md](EVALUATION.md). Keep the cheap `log_proxy` numbers (characters saved, evidence kept) separate from `agent_task` results.
2. Pre-register tasks in a manifest (`evals/agent-manifest.json` shows the shape), run each task under `baseline`, `local` (rules) and `jev`, several repeats, on identical commits and verifiers.
3. Record one JSON line per run (`evals/agent-record.example.json`), then `node cli/jev.ts report --manifest M --records R`. The bootstrap uses a seeded generator, so its confidence intervals are deterministic but not numerically comparable with reports made by v0.4.x and earlier.
4. Compare `jev` against `local`, not only against baseline, so a cheaper-model effect is not credited to Jev. Missing runs, unknown costs or too few tasks give INCOMPLETE / UNKNOWN_COST / INSUFFICIENT_EVIDENCE, never GO. The gate numbers are a product policy you may change, not a proven threshold.

### Upgrade, rollback, uninstall

- Update (per the Claude Code docs; not re-verified here): Claude Code's auto-update is off by default for third-party marketplaces; enable it in `/plugin` → Marketplaces → jev-agent-kit → Enable auto-update (it checks after the first message of a session, up to about 10 minutes later, and the new version loads on the next launch or after `/reload-plugins`), or run `claude plugin update jev-agent-kit@jev-agent-kit`. Installed plugins are cached by version, so a fix only arrives with a new `plugin.json` version (git tags alone do not trigger an update). A plugin cannot trigger or check for updates itself. Whether saved settings survive an update is not documented by Claude Code and is not yet tested here.
- Roll back: reinstall the earlier tag, or remove and re-add the marketplace pinned to it. Project config files stay valid across 0.1 to 0.2 (`schemaVersion` 1).
- Stop using it in one project: set `"enabled": false` (or delete the file). Everywhere: `claude plugin disable jev-agent-kit`, or `claude plugin uninstall jev-agent-kit`.
- Remove stored data: delete `~/.cache/jev-agent-kit/` (or your `JEV_STATE_DIR`). Originals and records live only there.

### Privacy and data flow

What leaves your machine depends on `backend`, not on `mode`:

| `backend` | `mode` | Sent to `api.typesafe.ai`? | Output changed? |
|---|---|---|---|
| `rules` | `observe` | **Nothing.** | No (records only). |
| `rules` | `assist` | **Nothing.** | Yes, pruned locally. |
| `jev` | `observe` (shadow) | **Yes**: redacted log blocks, the goal text and your API key, for each long output that reaches Jev (not below `minimumChars`, not at the host cap, not over the 96-block / 60 KB budget, not without a key). | No (records what Jev would keep). |
| `jev` | `assist` | **Yes**, same as above. | Yes, pruned with Jev relevance; falls back to the original on any failure. |

For `jev`, redacted log blocks (secrets pattern-masked, best effort), the goal text and your API key go **only** to `https://api.typesafe.ai/v1/systemone`. Output that is too large (over 96 blocks or about 60 KB per request) is not sent; the original is used. `/jev preset` and `/jev init` print this when they write `backend: jev`, and `/jev doctor` shows the backend and where its value came from.

Decision records hold counts, reason codes, timing, token usage and an artifact id. They never hold code, prompts, commands, full logs, keys, response bodies or exception text. Optionally put a one-line task description in `.claude/jev-goal.txt` to tell Jev what evidence is relevant (it is redacted before sending).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/jev` not found | Mod not loaded: update Claude Code, or check `claude --debug-file f.log` for `hooks module jev-agent-kit`. |
| Nothing is pruned | `/jev doctor` (is `enabled=true`?), output under `minimumChars`, or `observe` mode. |
| `reason: redaction_unavailable` | Nothing was sent to Jev because the redaction pass could not run safely (it should not happen on real input); the original output was used. |
| `/jev status` shows a `reason` other than `ok` | That is the fallback cause (`missing_key`, `http_429`, `timeout`, ...); the original was used. The same code appears once as a toast. |
| `http_404` or `invalid_model` after TypeSafe retires a model | Set the Jev model to `jev-latest` in the Configure form. |
| `backend: jev` but nothing is shortened on a long log | The log has more than 96 candidate blocks (about 800 short lines): reason `budget_fallback_original`, nothing was sent. The local rules still work for it (`backend: rules`) |
| `/jev mode assist` changed nothing | A field in the project file wins over `/jev mode` and the Configure form; check `/jev doctor`, then edit the file or delete it and `/jev preset <name>` |
| Edits to the installed plugin ignored | Installed plugins are cached by version; develop with `--plugin-dir`. |

## Develop and verify

```bash
node --test cli/tests/*.spec.ts            # CLI, state, metrics and release-gate tests (Node 22.18+)
claude plugin test                         # TypeScript core + Mod tests, offline
claude plugin validate --strict .
node cli/jev.ts bench-logs --outdir results/offline   # mock demo, NOT a quality or billing result
node scripts/release-check.ts              # the local release gate (add --release to tag)
```

Type-check (also a step of the release gate): `npm ci` once, then `npm run typecheck`. Two projects: `tsconfig.node.json` (cli, scripts, core: needs only `typescript` and `@types/node`) and `tsconfig.plugin.json` (hooks, core, tests against Claude Code's own types, which Claude Code writes to `.claude-plugin/types/` the first time a mod loads in an interactive session; git-ignored). The Mod's `$` is typed with Claude Code's `EngineInterface`, so a wrong API call is a compile error.

Layout: `core/` pure TypeScript (no mods API), `hooks/register.ts` the only file that talks to Claude Code, `cli/` the Node maintainer CLI (it imports the same core), `tests/fixtures/golden.ts` the frozen behavior contract. See [CLAUDE.md](../CLAUDE.md) and [docs/HANDOVER.md](HANDOVER.md). Verified vs not-run: [docs/compatibility.md](compatibility.md). Original v0.1 Chinese README: [docs/README.v0.1.zh-TW.md](README.v0.1.zh-TW.md).

## Using it with other Jev mods

Works alongside [fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) (MIT, whole-conversation compaction). They hook different events (ours: `tool.call`; theirs: `session.compact`, `turn.complete`), and loading both in a real session worked: both modules loaded, no hook was skipped, and our pruning ran. **Not tested:** an actual compaction with both active (it needs a Jev key and a long session). Install them separately; neither depends on the other.

## Limits

Not a security control. Not proven to save money (a 4-task smoke eval passed 32/32 in both arms at about $0.0031 vs $0.0040 per run; that is not evidence of a benefit). The loop detector only observes. Output that Claude Code itself cut at 30,000 characters is left alone. Windows is untested (see Cross-platform notes). Jev is early access and English-first; evaluate Chinese or mixed code/prose logs separately.
