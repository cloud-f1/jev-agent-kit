# Changelog

## 0.2.1 (2026-10-10)

Ideas taken from reading fast-jev-compaction's source (MIT, nothing copied; see docs/sources.md).

- New: failures are visible. When pruning or the Jev backend falls back to the original output, a toast says so once per reason per session with a fixed reason code (`http_429`, `missing_key`, ...), plus a debug-log line for every decision (`claude --debug-file f.log`). Previously the reason was only in `/jev status`, so a bad key looked like "nothing happens".
- New: API key is also read from Claude Code's `settings.json` `env` block (order: environment, plugin setting, settings.env, `JEV_ENV_FILE`).
- New: `Jev model` setting (default stays the pinned `jev-1.13.0`; `jev-latest` allowed). The response may name any `jev-*` model, and decision records now hold `requested_model` and `actual_model`. Before, any other model in a response was rejected, so a retired model would have turned Jev off silently.
- Tests: 57 Python + 82 Mod/core tests. Verified live: both this plugin and fast-jev-compaction loaded together without interference.

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
