# Changelog

## Version history

| Version | Date | Headline |
|---|---|---|
| 0.3.0 | 2026-10-10 | `/jev on|off|mode|init`, measured receipt line, pause after read-back, optional type-check; live synthetic benchmark run |
| 0.2.1 | 2026-10-10 | Visible failures (toast + debug log), key from user `settings.json` env, `Jev model` setting, audit fixes |
| 0.2.0 | 2026-10-10 | Native TypeScript Mod replaces the Python hook; `/jev` commands; `/config` settings; independent audit fixes; cross-platform code path |
| 0.1.0 | | Python core, classic hook, log pruning with read-back, smoke, bench, paired report |

Not done in any version: Jev pruning in a real session, `bench-logs --live`, and a paired agent-task benchmark. Cost or success benefit is unproven.

## 0.3.0 (2026-10-10)

- New: `/jev on`, `/jev off`, `/jev mode observe|assist` change your plugin settings through `$.config.set` (rows `jev-agent-kit.<field>`; only `enable_all_projects` and `mode` are ever written). A refused change is reported as such.
- New: `/jev init [observe|assist]` creates `.claude/jev-agent-kit.json` for the project and never overwrites an existing one.
- Changed: the read-back line now carries measured counts: `pruned <chars in> -> <chars out> chars`. Characters only; no token or dollar estimate.
- Changed (behavior): after a `/jev readback` in a session, `assist` stops rewriting for the rest of that session (fixed reason `paused_after_readback` in the decision record; the status line says so). Fails toward the original output.
- Documented and tested: `observe` with `backend: jev` is shadow mode (asks Jev, records, never rewrites). It still sends redacted blocks to the API.
- New: `scripts/typecheck.sh` (maintainers, needs Node, outside the gate) and a typed `register(on: On, options?: PluginOptions)`; fixed a `Uint8Array` typing error in `core/hash.ts`. Helpers still take `$: any`, so API-call shapes are not yet type-checked.
- Verified live (once): `jev.py bench-logs --live` on the 5 synthetic fixtures: 5 of 5 decisions valid; Jev kept 100% of the planted evidence at about 71% character reduction, local rules kept 50% at about 80%. Planted-evidence proxy only: not agent-task evidence, no cost or success claim.
- Not done: collapsing repeated lines (it must not drop error-bearing lines; needs a design and evidence), the paired agent-task benchmark (needs a budget), a Windows run, `/jev savings`, a pane, presets. The interactive effect of `/jev on|off|mode` on a real `/config` screen was not seen (stubbed tests only).
- Tests: 58 Python + 91 Mod/core tests.

## 0.2.1 (2026-10-10)

Ideas taken from reading fast-jev-compaction's source (MIT, nothing copied; see docs/sources.md).

- New: failures are visible. When pruning or the Jev backend falls back to the original output, a toast says so once per reason per session with a fixed reason code (`http_429`, `missing_key`, ...), plus a debug-log line for every decision (`claude --debug-file f.log`). Previously the reason was only in `/jev status`, so a bad key looked like "nothing happens".
- New: API key is also read from Claude Code's `settings.json` `env` block (order: environment, plugin setting, settings.env, `JEV_ENV_FILE`).
- New: `Jev model` setting (default stays the pinned `jev-1.13.0`; `jev-latest` allowed). The response may name any `jev-*` model, and decision records now hold `requested_model` and `actual_model`. Before, any other model in a response was rejected, so a retired model would have turned Jev off silently.
- Security (read-only audit of this release, fixed with regression tests): the `settings.json` key is read from the **user** source only, so a cloned repo's `.claude/settings.json` can no longer supply the key; a pinned model must answer as itself (`model_mismatch`), only `jev-latest` may resolve to another name (both cores); an internal error now writes a fixed line to the debug log, as its toast promises.
- Verified live (once): `jev.py smoke` with a synthetic sentence returned `api_validated`, and `jev-1.13.0` answered under that name. Not run: `backend: jev` pruning in a real session, `bench-logs --live`.
- Tests: 58 Python + 84 Mod/core tests. Verified live: both this plugin and fast-jev-compaction loaded together without interference.

## 0.2.0 (2026-10-10)

- New: native Claude Code Mod (`hooks/register.ts`, TypeScript, no build step). Wraps Bash `tool.call`, prunes long output in `assist` mode, keeps `stderr` intact, stores the untouched original, and adds a read-back pointer.
- New: `/jev status | doctor | readback <id>` commands (no model turn).
- New: pure TypeScript core in `core/` (config validation, pruning, Jev response validation, hashing), byte-for-byte parity with the Python core checked against a shared golden fixture (`scripts/gen_golden.py`).
- New: session marker `mod-active/<hash>`; the classic Python hook skips sessions the Mod owns, so nothing runs twice. Older Claude Code without Mod support still gets the classic hook.
- Fix: removed `defaultEnabled: false` from `plugin.json`. With it, a `--plugin-dir` load registered neither the module nor the hooks. Projects stay opt-in through `.claude/jev-agent-kit.json` (`enabled` defaults to false).
- New: `scripts/release_check.py` local release gate; project-only `release` skill; expanded `operate` skill.
- Security/correctness (independent audit, all fixed, each with a regression test): redaction now catches Bearer/Basic tokens and quoted/JSON secrets (they previously reached the Jev API); both cores use identical ASCII-only regex semantics and count code points; retention is enforced when the Mod owns the session; `delivered_chars` no longer claims savings for results that were not rewritten; project-root hash resolves symlinks; `JEV_STATE_DIR` must be absolute (`~` and `~/` only); every new state directory is `0700`; git failure no longer reports a known repo state; secret scan catches quoted/JSON keys and non-UTF-8 files.
- New: plugin settings (`userConfig`) shown in `/config`: mode, backend, minimum length, keep threshold, retention, enable-in-every-project, and a `sensitive` API key kept in secure storage. Precedence defaults < plugin settings < project file, shared by the Mod (`register(on, options)`) and the classic hook (`CLAUDE_PLUGIN_OPTION_*`), checked against the same golden table. `/jev doctor` reports the source of every value. Raises the minimum Claude Code for the plugin to 2.1.271 (picker `options`).
- Tests: 56 Python + 69 Mod/core tests (`claude plugin test`).
- Removed: GitHub Actions workflow (no CI quota); the local gate replaces it.
- Removed: the Python classic hook, its installer (`jev.py hook`, `jev.py install`) and the `mod-active` marker. The plugin is now one TypeScript Mod; Claude Code 2.1.271 to 2.1.286 loads it but it does nothing (update Claude Code). No Python, uv or Node is needed to use the plugin. The gate rejects classic `hooks` entries so they cannot return by accident.
- Cross-platform: the Mod resolves paths with `$.fs.stat({resolve: true}).realPath` (no `pwd -P`), picks `USERPROFILE` when `HOME` is unset, accepts drive/UNC state dirs, and has a Windows branch (file-API writes, PowerShell retention). The Windows branch is covered by stubbed tests only and has never run on Windows.
- New: `pyproject.toml` so `uvx --from git+https://github.com/cloud-f1/jev-agent-kit jev doctor` works; Python is now only the optional maintainer/eval CLI and the parity reference.
- Not done: model routing (`agent.spawn`/`turn.step`), real Agent-task benchmark, live Jev API validation.

## 0.1.0

- Baseline: Python stdlib core, classic hook adapter, log pruning with read-back, loop observation, smoke, bench, paired report. Packaging: MIT license, marketplace manifest, `operate` skill.
