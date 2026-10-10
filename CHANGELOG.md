# Changelog

## Version history

| Version | Date | Headline |
|---|---|---|
| 0.6.4 | 2026-10-10 | CLI `--help`, `doctor --verify`, config sources, read-back after `/jev init` and `/jev preset`, backend data-flow table, Node wrapper (JEV-30, JEV-31) |
| 0.6.3 | 2026-10-10 | Messages and docs point to the real settings path (`/plugin` → Configure), Node 22.17 note, README status brought up to date; found from a real interactive install |
| 0.6.2 | 2026-10-10 | Updated skills (operate, release) + new live-test skill; docs record that the Jev backend does not act on logs above ~96 blocks (found in a real session); no runtime change |
| 0.6.1 | 2026-10-10 | Docs and gate only: tester checklist (`docs/TESTING.md`), rewritten handover, aligned links, markdown-link check in the gate; no runtime change |
| 0.6.0 | 2026-10-10 | `/jev pane`, real types for the Mod, type-check in the gate, paired eval cases that found and fixed two real failures (unreadable read-back pointer; output cut by the host) |
| 0.5.0 | 2026-10-10 | Node and TypeScript only: the maintainer CLI, release gate and tests are ported; Python removed; verified by a 178-comparison differential |
| 0.4.0 | 2026-10-10 | `/jev preset`, `/jev savings`, repeated-warning collapse (errors never collapsed), honest `/jev on|off|mode` |
| 0.3.0 | 2026-10-10 | `/jev on|off|mode|init`, measured receipt line, pause after read-back, optional type-check; live synthetic benchmark run |
| 0.2.1 | 2026-10-10 | Visible failures (toast + debug log), key from user `settings.json` env, `Jev model` setting, audit fixes |
| 0.2.0 | 2026-10-10 | Native TypeScript Mod replaces the Python hook; `/jev` commands; `/config` settings; independent audit fixes; cross-platform code path |
| 0.1.0 | | Python core, classic hook, log pruning with read-back, smoke, bench, paired report |

Not done in any version: Jev pruning in an interactive session, and a paired agent-task benchmark on real repositories. Cost or success benefit is unproven.

## 0.6.4 (2026-10-10)

From two maintainer-filed tickets: JEV-30 (CLI help and Node 22 invocation) and JEV-31 (config confirmation and key validation).

### New
- `node cli/jev.ts --help`, `-h` and `help` exit 0 with one line per command, and mark the commands that use the network (`smoke`, `bench-logs --live`, `doctor --verify`). `--version` prints the version. Before, `--help` exited 2 with an error.
- `scripts/jev.sh` (and `npm run jev -- <command>`) runs the CLI with `--experimental-strip-types` on Node 22.6 to 22.17 and without it on newer Node.
- `doctor --verify` sends one synthetic sentence and reports `key_check`: `valid`, `invalid (401)`, `missing` or `error (<reason>)`. Plain `doctor` stays offline. Exit 3 unless `valid`.
- `check-config` also prints a `sources` map: where each value came from (default, plugin settings via `CLAUDE_PLUGIN_OPTION_*`, project file). The existing fields are unchanged.
- `/jev init` and `/jev preset <name>` read the file back and print the resulting `enabled`, `mode`, `backend`, and say whether anything leaves the machine. When the file already exists they print its current values and how to switch (edit `mode` or `backend`, or delete it and run `/jev preset <name>`). Only known values are shown; anything else prints `?`.
- README: a backend x mode table of what is sent to the API.

### Changed
- Messages in `hooks/register.ts` only (the two commands above); no pruning, threshold, model, request or data-sent change. `core/` differs from 0.6.3 only in the version string.

### Verified
- 49 Node tests and 111 Mod tests pass; the release gate is green.
- Live, with the real key: `doctor --verify` gave `valid`; a deliberately fake key gave `invalid (401)` (one request with a fake key, no real data). In a real headless `claude -p` session `/jev preset shadow-jev` printed the read-back and the data-sent note, and a second preset printed the current values and the switch hint without overwriting the file.

### Not done
- A `--force` overwrite flag (deliberately not added: overwriting a project file is easy to do by hand and hard to undo).
- `check-config` shows only plugin settings passed as `CLAUDE_PLUGIN_OPTION_*`; the real merge with Claude Code's stored settings is `/jev doctor` in a session.
- Windows, the pane in a narrow terminal, and the sensitive-key field's masking are still unseen.

## 0.6.3 (2026-10-10)

Found by watching a real interactive install (screenshots from the maintainer's machine).

### Fixed
- `/jev doctor`, the opt-in hint and the `/jev on|off|mode` failure text told people to use `/config`. In the real interactive session `/config` showed no plugin rows (it toggled a Claude Code setting). They now name `/plugin` → Installed → Jev Agent Kit → Configure, which the install flow also opens. README, TESTING and the operate skill say the same.
- README status line said `bench-logs --live` and the Jev backend had never run; both were run (synthetic text) in earlier versions. It now says what was run and what was not.
- README lists the Node 22.6 to 22.17 invocation (`node --experimental-strip-types cli/jev.ts`) for the maintainer CLI (a real user hit this on 22.17).

### Changed
- Only message strings in `hooks/register.ts`; no pruning, threshold, model or data-sent change.

### Verified
- Live smoke through the CLI: `api_validated`, `jev-1.13.0` answered as itself, 281 input / 20 output tokens (synthetic sentence only).

### Not verified
- How the sensitive key field masks typed input; whether `/jev on|off|mode` works in the interactive session of the installed 0.6.x (checked interactively only on 0.5.0); running next to fast-jev-compaction in a real long session.

## 0.6.2 (2026-10-10)

No runtime change: `hooks/` and `core/` differ from 0.6.1 only in the version string. The shipped `operate` skill changed, so users need this release to get it.

- Found (real `claude -p` session, `backend: jev`, `assist`, synthetic 27 KB log): Jev was **not called**; the result was `budget_fallback_original` and the output came back unchanged. The per-request limit is 96 non-pinned blocks of 8 lines, or 60 KB; measured: about 800 short lines (~14,000 characters) is the largest log Jev is asked about. Every earlier Jev test used 320-line logs and the eval suite uses the local rules backend, so this was never exercised. Not changed in code: documented everywhere it matters (README, TESTING, compatibility, operate skill) and tracked as Jira JEV-29 (split long logs into several requests, or accept the limit).
- Changed: `skills/operate/SKILL.md` (shipped) rewritten for 0.6: all commands incl. `savings`, `pane`, `preset`, which ones work only interactively; the 30,000-character cut and the `minimumChars` window; the receipt naming a readable file and the read-back/pause rule; repeated-warning collapse; the Jev backend limit; "a project file field beats `/jev mode`"; more diagnosis rows; evals with `--no-publish`.
- Changed: `.claude/skills/release/SKILL.md` (project-only) rewritten: prerequisites (`npm ci`, Claude-generated types), lockfile version, an audit for every release, docs written from observed behavior, the full gate step list, verification by walking `docs/TESTING.md` from a marketplace install and then uninstalling it, Jira statuses.
- New: `.claude/skills/live-test/SKILL.md` (project-only): the three live layers (headless, paired evals, `expect` on the TUI), their safety rules and traps, and what cannot be verified here.
- Verified live in the same session: under the limit, `backend: jev` works in a real `claude -p` session. A synthetic 600-line log (10,701 characters) gave `reason: ok`, `actual_model: jev-1.13.0`, 7,563 input tokens (about $0.0003), 10,701 -> 978 characters, and no key-like text in the record.
- Not verified: the status line under the prompt and a narrow-terminal pane (a scripted attempt exited at the trust dialog and was not repeated), the sensitive-key prompt, the Jev backend in an interactive session, Windows.

## 0.6.1 (2026-10-10)

No runtime change: `hooks/` and `core/` differ from 0.6.0 only in the version string (`git diff v0.6.0 -- hooks core` is one line). Released so that an installed copy (which is the whole repository at the tag) carries the corrected documentation.

- New: `docs/TESTING.md`, a one-page tester checklist (Traditional Chinese): install, opt in, observe, assist, pane, read-back, the 30,000-character cut, a non-error needle, clean-up, what to report. Written against what was actually observed; the read-back rule is stated precisely (a Bash command or `/jev readback` counts, the Read tool alone does not).
- Changed: `docs/HANDOVER.md` rewritten to the real current state (it still described v0.2.1 as unreleased); `docs/compatibility.md` brought to 0.6.0 (header, test counts, install rows, interactive status, the two things learned about Claude Code's output cut and slash commands); README gained a documentation map and a pointer to the checklist; PRD, EPICS, CLAUDE.md and the release skill link to each other.
- New: the release gate fails on a broken relative Markdown link (`markdown links` step). It checks against `git ls-files`, so a wrong-case target (fine on macOS, broken on GitHub/Linux) or an uncommitted file fails; handles titles, `<...>` targets, reference-style links, `%20`, query strings and root-absolute paths; ignores code fences and inline code; does not check `#anchors`. 40 Node tests.
- Fixed in the checklist before release (found by the read-only audit): switching to `assist` must replace the project file (a project file's `mode` overrides `/jev mode`), and the non-error-needle test has to run before the read-back, which pauses rewriting.
- Housekeeping done on the maintainer machine: the stale 0.2.0 local-scope install and the test install of 0.6.0 were uninstalled. Old version folders remain in Claude Code's plugin cache; they are inert and Claude Code has no prune command for them.
- Tests: 40 Node + 109 Mod/core tests.

## 0.6.0 (2026-10-10)

- New: `/jev pane` opens a side pane (and `/jev pane close` closes it) with the same counted characters and recent decisions as `/jev savings` and `/jev status`. Drawn from a `ui.render` hook in `hooks/register.ts`; refreshes at most every 3 s; shows only counts and fixed reason codes, never content or keys. Seen working in a real interactive session (two seeded records of 30,000 -> 640 characters drew as "2 logs rewritten, 58720 chars removed net"; close worked). Not seen: a narrow terminal, other surfaces.
- Changed (maintainers): every `$` in the Mod is now `EngineInterface` from Claude Code's generated types and the handlers' arguments are inferred, instead of `any`. A deliberate typo (`$.fs.reed`) is now a compile error. `typescript` and `@types/node` are dev-only dependencies (`package-lock.json` is checked in; the plugin itself still has no dependencies). `npm run typecheck` runs `tsconfig.node.json` (cli, scripts, core) and `tsconfig.plugin.json` (hooks, core, tests); both are steps of the release gate (SKIPPED, hence a release failure, if `npm ci` or the generated `.claude-plugin/types` are missing). `scripts/typecheck.sh` is gone.
- Fixed in passing: index-possibly-undefined cases found by `noUncheckedIndexedAccess` in `core/prune.ts` and `cli/metrics.ts` (no behavior change; golden fixture and all tests unchanged).
- Changed (behavior; found by the new eval suite): the receipt now names a file the model can read: `The full original is in the file <state>/artifacts/<id>.log (read it with your Read tool or cat); the user can run /jev readback <id>`. Before, it only pointed at `/jev readback`, a slash command the model cannot run, so when pruning dropped a non-error line the model could not get it back (measured: 1 of 5 runs passed with the plugin vs 5 of 5 without). A Bash command that mentions that artifacts folder now counts as a read-back (rewriting stops for the project, and that command's output is returned whole).
- Changed (behavior; found by the same suite): output that looks cut by Claude Code is left alone. Claude Code truncates Bash output at 30,000 characters (`BASH_MAX_OUTPUT_LENGTH`) before any hook runs and keeps the complete text in its own file. At the cut the kit only sees a head, so its stored "original" is incomplete and its pruned text could hide the tail from the model (measured: an error beyond the cut was not found by 1 of 6 runs with the plugin vs 6 of 6 without, and the model searched the kit's incomplete copy). From 99% of the cap upward the kit records `host_truncated_output` and returns the result unchanged. The kit therefore only acts on outputs between `minimumChars` (default 8,000) and about 29,700 characters.
- New: `evals/` holds four paired `claude plugin eval` cases (see `evals/README.md`). Smoke result on the final cases, haiku, 8 runs each, local rules backend: 32 of 32 passed with the plugin and 32 of 32 without; mean agent cost per run $0.0032 with vs $0.0040 without (the two in-range cases were cheaper with the plugin, $0.0025 vs $0.0039 and $0.0025 vs $0.0046; the negative control cost slightly more, $0.0045 vs $0.0043, with one more turn; the oversized case was equal). This is 4 synthetic tasks on one cheap model: it shows the mechanism now behaves, it is **not** evidence of a general cost or success benefit.
- Audit (read-only, fresh agent): no high findings. Fixed: a nonsense `BASH_MAX_OUTPUT_LENGTH` (negative, 0, text) now falls back to 30,000 instead of switching pruning off; the pane cache is keyed by project; the gate also checks `package-lock.json`'s version; stale receipt text in the docs; the eval cases declare the `Read` tool they need. Left as is on purpose: any command naming the artifacts folder pauses rewriting for that project (fail-safe, only loses savings); the receipt path shows the user's own state folder to the model. Final code re-run through the eval suite: 32 of 32 passed with and without the plugin, mean agent cost per run $0.0031 vs $0.0040.
- Tests: 39 Node + 109 Mod/core tests.

## 0.5.0 (2026-10-10)

- Changed (maintainers only; the plugin's behavior for users is unchanged): everything is Node + TypeScript. The Python reference core (`jevkit/`), CLI (`jev.py`), release gate, golden generator, `pyproject.toml` and 60 Python tests are removed. `uv` and `uvx` are no longer used.
- New: `cli/jev.ts` (doctor, smoke, bench-logs, status, readback, check-config, report) imports the same `core/*.ts` the Mod uses, so there is one implementation. Node 22.18+ runs it directly. Node refuses to strip types inside `node_modules`, so it runs from a checkout (no `npx` install).
- New: `scripts/release-check.ts` (version places are now three: `core/contracts.ts`, `plugin.json`, `package.json`, plus the CHANGELOG heading) and `scripts/gen-golden.ts`, which now only checks the frozen fixture unless run with `--write`. `package.json` has no dependencies.
- New: 38 Node tests (`cli/tests/*.spec.ts`) replace the Python tests: state and permissions (`0600`/`0700`), env-file handling, transport reason codes and no redirects, settings layering against every golden merge case, metrics, the log benchmark, and the gate itself.
- Verification: before deleting Python, the old and new CLIs were compared on 178 cases: state-root hashes, 150 random plugin-option and project-file combinations, the mock benchmark's rows and files, and 20 report scenarios. 0 differences after ignoring float noise (`1.0` vs `1`, `4.199999999999999` vs `4.2`) and two fields only the TypeScript records carry (`requested_model`, `actual_model`). The live API also returned `api_validated` through the TypeScript CLI.
- Changed: `report`'s bootstrap uses a seeded JavaScript generator, so confidence intervals are deterministic but not numerically comparable with Python-era reports; statuses on the same data matched.
- Found live (interactive session, driven with a pinned `expect` script): `/jev mode assist` works in a real interactive session ("Set mode=assist", hooks reloaded), so the v0.4.0 limitation applies to headless `claude -p` only. Claude Code also writes `.claude-plugin/types/` and a `tsconfig.json` there, which the optional type-check can use.
- Audit (read-only, fresh agent): no high findings. Fixed: `--env-file PATH` (space form) now works anywhere on the line; the request deadline now covers the body and the size cap applies while reading; the gate fails on zero or skipped Node tests; `report` requires an `experiment_id` and valid gate values; release skill and fixture header no longer mention Python.
- Not done: a pane, the paired agent-task benchmark (budget), a Windows run.

## 0.4.0 (2026-10-10)

- Fixed (found live): in v0.3.0 `/jev on|off|mode` called `$.config.set` with key `jev-agent-kit.<field>`, but a real headless session has no `/config` row for this plugin (`no /config row with key ...`), so it never worked there; the stubs hid it. It now says so and points to `/config` or `claude plugin configure jev-agent-kit`. Not seen in an interactive session (a scripted interactive run was blocked by the harness's safety check, so the interactive behavior is still unverified).
- New: `/jev preset <name>` (`observe-local`, `shadow-jev`, `prune-local`, `prune-jev`) writes the project file with fixed fields only and never overwrites. Seen live with `claude -p`.
- New: `/jev savings` reports counted characters from this project's records (what assist removed; what it would have removed in observe; fallbacks). No token, cost or success claim.
- Changed (behavior, both cores, golden regenerated; existing cases byte-identical): runs of 6 or more consecutive warning-only lines that differ only in digits are collapsed to the first 2, a count marker and the last 1. Lines with an error-class word, a stack frame or a `File` line are never collapsed. A run of warnings with any such word is untouched. Any non-ok result still returns the exact original. Example on a synthetic log: 9,710 -> 763 characters.
- Not done: a pane (needs an interactive session to verify), paired agent-task benchmark (budget), Windows run.
- Audit (read-only, fresh agent): no safety or parity break; a 3,000-input fuzz found 0 differences between the cores and 0 lost error-class lines. Its findings on `/jev savings` are fixed: only rows that were really rewritten count, the total is net of the receipt line, non-finite values are ignored, and the header counts record files scanned.
- Tests: 60 Python + 96 Mod/core tests.

## 0.3.0 (2026-10-10)

- Audit (read-only, fresh agent): nothing high; `/jev on` now says it applies to ALL projects, and the read-back pause is per project. Not verified: the real `$.config.set` / `$.fs.write` behavior.
- New: `/jev on`, `/jev off`, `/jev mode observe|assist` change your plugin settings through `$.config.set` (rows `jev-agent-kit.<field>`; only `enable_all_projects` and `mode` are ever written). A refused change is reported as such.
- New: `/jev init [observe|assist]` creates `.claude/jev-agent-kit.json` for the project and never overwrites an existing one.
- Changed: the read-back line now carries measured counts: `pruned <chars in> -> <chars out> chars`. Characters only; no token or dollar estimate.
- Changed (behavior): after a `/jev readback` in a session, `assist` stops rewriting for the rest of that session (in that project only; fixed reason `paused_after_readback` in the decision record; the status line says so). Fails toward the original output.
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
