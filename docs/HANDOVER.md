# Handover: jev-agent-kit (written 2026-10-10, after v0.2.1 was built)

For the next Claude Code session. Read in this order: `CLAUDE.md` (rules), this file (state), `docs/compatibility.md` (what is verified and what is not), `docs/sources.md` (what we may reuse from other repos). The v0.1 research background is `docs/REPO_HANDOVER.md`.

## Where things stand (read first)

| Item | State |
|---|---|
| v0.2.0 | **Released.** `main` + tag `v0.2.0` + GitHub release: https://github.com/cloud-f1/jev-agent-kit/releases/tag/v0.2.0. Installing it from the real marketplace was verified. |
| v0.2.1 | **Built and committed on local branch `v0.2.1`. NOT pushed, NOT merged, NOT released.** Gate is green. |
| Done this session | User approved audit, release and smoke test. Audit fixes applied; live `smoke` passed once (`api_validated`, `jev-1.13.0`); v0.2.1 merged, tagged and released (see CHANGELOG). Post-release check done: v0.2.1 installed from the real marketplace in a scratch project and `/jev doctor` reported 0.2.1. `claude plugin list` also shows a stale 0.2.0 local-scope entry that was not cleaned up. |
| Public claim status | Mechanism works; **cost or success benefit is unproven.** Do not claim savings anywhere. |

## What the product is

Public repo `cloud-f1/jev-agent-kit` (MIT). A Claude Code plugin that shortens long Bash output before the model sees it, always keeping the original recoverable. Unofficial; not affiliated with TypeSafe AI.

- **One native Mod**: `hooks/register.ts` (TypeScript, loaded directly, no build) + pure core `core/*.ts`. `hooks/hooks.json` contains only `"modules"`. The release gate rejects classic `hooks` entries.
- **Requires Claude Code 2.1.287+.** On 2.1.271 to 2.1.286 the plugin loads but does nothing (it needs 2.1.271 only because `/config` pickers use `options`).
- **Python is not part of the runtime.** `jevkit/`, `jev.py`, `pyproject.toml` are the optional maintainer/evaluation CLI (run with `uv`) and the **reference implementation** the TS core must match (golden fixtures).
- Commands in a session: `/jev status | doctor | readback <id>` (no model turn).
- Settings screen: `userConfig` in `.claude-plugin/plugin.json` shows in `/config` (mode, backend, minimum length, keep threshold, retention days, enable-in-every-project, model) plus a sensitive API key in secure storage. Precedence: **defaults < plugin settings < project file `.claude/jev-agent-kit.json`**. A project cannot set the endpoint, key, credentials or model.
- Key lookup order: `TYPESAFE_API_KEY` env, plugin setting, Claude Code `settings.json` env block (v0.2.1), `JEV_ENV_FILE`.
- Skills: `skills/operate` (shipped to users), `.claude/skills/release` (project only).
- Local release gate: `uv run --no-project scripts/release_check.py [--release]`. No CI exists (no quota).
- Tests: **58 Python** (`uv run --no-project python -m unittest discover -s tests`; verified on Python 3.10 to 3.14) and **84 Mod/core** (`claude plugin test`, offline).

### What v0.2.1 adds (on the unreleased branch)

Ideas from reading `tamaratran/fast-jev-compaction` (MIT, commit `e3f262a`) at source level; **no code was copied**:
1. Failures are visible: a toast once per fallback reason per session (fixed reason codes only, never response text) plus a debug-log line for every decision.
2. API key also read from Claude Code's `settings.json` `env` block.
3. `Jev model` setting: default stays pinned `jev-1.13.0`; `jev-latest` allowed; responses may name any `jev-*` model; records hold `requested_model` and `actual_model`.

Also verified: that plugin and ours load together in one real session without interference (modules in separate worker environments, no hook skipped). **Not tested:** a real compaction with both active.

## File map

```
.claude-plugin/plugin.json, marketplace.json   manifest (userConfig lives here), single-plugin marketplace
hooks/register.ts                              ONLY file that calls the mods API ($)
hooks/hooks.json                               {"modules": ["./register.ts"]}
core/*.ts                                      pure: contracts, config (+settings layer), hash, prune
jevkit/, jev.py, pyproject.toml                Python reference core + optional CLI (doctor, smoke, bench-logs, status, readback, check-config, report)
scripts/release_check.py                       local release gate
scripts/gen_golden.py                          regenerates tests/fixtures/golden.{json,ts} from the Python core
tests/*.test.ts, tests/test_*.py               TS (claude plugin test) and Python suites
skills/operate/SKILL.md                        shipped skill      .claude/skills/release/SKILL.md   maintainer skill
docs/                                          compatibility.md, sources.md, EVALUATION.md, REPO_HANDOVER.md (v0.1 research), README.v0.1.zh-TW.md, this file
```

## Verified, and what is NOT

Verified live (Claude Code 2.1.295, `claude -p --model haiku`, scratch project): module loads alone (`Registered 0 hooks`), a 30,000-character log became 570, the model received the pruned text plus the readback line, `/jev doctor` and `/jev status` work, state files `0600` and directories `0700`, the project hash equals the Python core's, v0.2.0 installs from the real marketplace.

**Not verified:**
- The live Jev API beyond one `smoke` call: `backend: jev` in a real session and `bench-logs --live` are not run. (`/jev doctor` shows a key present in this machine's environment; its value was never read.)
- Windows: the Mod's Windows branch (file-API writes, PowerShell retention, `USERPROFILE`, drive/UNC paths) has only stub tests on macOS.
- The interactive `/config` screen and the sensitive-key prompt (only seen through `claude -p`), `/jev readback` live, the status line, hot reload.
- Compaction with fast-jev-compaction active.
- **Any cost or success-rate benefit.** The paired agent-task benchmark (`docs/EVALUATION.md`) has not been run and needs a budget decision from the user.

## Decisions the user made

- Repo `cloud-f1/jev-agent-kit`, public, MIT.
- **Core ported to TypeScript** (not a bridge to Python); Python stays as reference and eval CLI.
- **Python classic hook retired** (2026-10-10); plugin is Mod-only; Python tooling runs through `uv`.
- Make the Mod cross-platform (done in code, unrun on Windows).
- Release skill is project-only; GitHub Actions removed (no quota).
- Adopt from the reference repo: visible failures, `settings.env` key, model setting (all three built). Coexistence with fast-jev-compaction: test only (done at load level). Whole-session compaction: not building.
- Reference repos: `jev-harness` has no license (ideas only); MIT/BSD ones may be reused with notices (see `docs/sources.md`).

## Traps already hit (do not rediscover)

- `defaultEnabled: false` in `plugin.json` makes a `--plugin-dir` load register no module and no hooks. The gate rejects it.
- An installed copy and a `--plugin-dir` copy share the name `jev-agent-kit`; disable the installed one before scratch tests (`claude plugin disable jev-agent-kit --scope local`).
- `claude plugin test` cannot import `.json`; fixtures are mirrored to `.ts` by `gen_golden.py`. A Python test fails if they drift.
- The test host normalizes `fs.write` paths against the macOS cwd, so Windows-path assertions use `includes`, not `startsWith`.
- `$.fs` has no chmod, delete or mkdir; the POSIX path writes via `sh -c 'umask 077; ...'` with stdin, retention via `find`.
- Claude Code caps Bash output near 30,000 characters before any hook sees it.
- `-I` on a script's Python invocation drops the script directory from `sys.path`; do not use it for `jev.py`.
- macOS has no `timeout` command; give long `claude -p` runs a tool timeout instead.
- zsh treats a bare `=====` as a command; quote separators in shell one-liners.
- The release gate's secret scan once silently skipped everything because an edit deleted `return files`; a test covers it. Secret-shaped fakes are allowed only under `tests/` and `scripts/gen_golden.py`. The scanner also flags code shaped like `KEY : value` (e.g. a ternary after `.TYPESAFE_API_KEY`); reshape the code (`['TYPESAFE_API_KEY']`) rather than weakening the gate.
- Installed plugins are cached by version: a fix reaches users only after bumping the version in **four** places (`jevkit/core.py`, `core/contracts.ts`, `.claude-plugin/plugin.json`, `pyproject.toml`) plus `CHANGELOG.md`. The gate checks they agree.
- Live-test recipe: scratch project outside this repo, `--model haiku`, throwaway `JEV_STATE_DIR`, `--debug-file`, grep the log for `hooks module jev-agent-kit`.
- Commit identity is repo-local `cloud-f1 <cloud-f1@users.noreply.github.com>` on purpose (keeps the machine hostname out of public history).

## Independent audit (done 2026-10-10)

13 findings; one high (redaction let Bearer and JSON-quoted secrets reach the Jev API). All fixed with regression tests; see `CHANGELOG.md` 0.2.0. Residual: `$.http.fetch` may follow redirects (the Authorization header is only ever sent to the fixed endpoint). A second read-only audit of v0.2.1 (2026-10-10) found: project `settings.json` could supply the key (fixed, user source only), the pinned model was not required to answer as itself (fixed, `model_mismatch`), internal-error toast had no debug line (fixed). See `docs/PRD.md`, `docs/EPICS.md` for product scope and epics, and `docs/sources.md` for the quicksilver review.

## Next steps, in order

1. Ask the user the two pending questions above. If yes to release: merge `v0.2.1` to `main` (fast-forward), run `uv run --no-project scripts/release_check.py --release`, follow `.claude/skills/release/SKILL.md` (tag, `gh release create`, then install from the real marketplace in a scratch project and run `/jev doctor`).
2. If yes to the live smoke test: `TYPESAFE_API_KEY` is already in the environment; run `uv run --no-project jev.py smoke` (synthetic sentence only), then optionally `bench-logs --live`. Report exit code 3 honestly; never paste or log the key.
3. v0.3 usability: `/jev on|off|mode` via `$.config.set`, `/jev init`, `/jev savings` (what `assist` would have saved, from `observe` data), optional `/jev` pane (tabs + Select), presets.
4. Test the Mod on a real Windows machine and fix what breaks.
5. Optional maintainer type-check: check in Claude Code's `claude-code.d.ts` and run `tsc` over `hooks/` (the reference repo does; needs Node; keep it out of the release gate).
6. Adoption backlog in `docs/sources.md` (shadow mode for the Jev decision, evidence-survival check, stop pruning after a read-back).
7. Only with a budget: run the paired benchmark (10 to 20 smoke tasks, then 100+). Until then the honest status is "mechanism works, benefit unproven".
