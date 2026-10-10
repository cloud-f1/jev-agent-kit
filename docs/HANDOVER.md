# Handover: jev-agent-kit (updated 2026-10-10, state after v0.6.2)

For the next Claude Code session. Read in this order: [`CLAUDE.md`](../CLAUDE.md) (rules), this file (state), [`compatibility.md`](compatibility.md) (what is verified and what is not), [`sources.md`](sources.md) (what may be reused from other repos). Product scope: [`PRD.md`](PRD.md) and [`EPICS.md`](EPICS.md). Tester checklist: [`TESTING.md`](TESTING.md) (Traditional Chinese). Background of v0.1: [`REPO_HANDOVER.md`](REPO_HANDOVER.md).

## Where things stand (read first)

| Item | State |
|---|---|
| Latest release | **v0.7.0** (`/jev doctor --verify` works in a session via shared `core/verify.ts`, JEV-33, on top of 0.6.6's shorter README and update hint; tag + GitHub release, installed from the real marketplace and checked). Releases `v0.2.0` to `v0.6.6` all exist; the changelog has a version-history table. |
| Release approval | The user gave a standing approval for releases (see `.claude/skills/release/SKILL.md`): fresh read-only audit with no unfixed high finding + green `node scripts/release-check.ts --release`. Still ask for: deleting or moving a tag, sending real (non-synthetic) project data to a third party, benefit claims, a failing gate or audit. |
| Open work | Jira **JEV-14** (the real paired benchmark: needs a budget decision from the user), **JEV-17** (a run on real Windows: needs a Windows machine) and **JEV-29** (the Jev backend sends nothing for logs above 96 candidate blocks, about 14 KB of short lines: needs a decision on splitting into several requests). Everything else in `EPICS.md` is done. |
| Installs on this machine | None: the stale 0.2.0 entry and the test install of 0.6.0 were uninstalled (2026-10-10). Old version folders remain in `~/.claude/plugins/cache/jev-agent-kit/`; they are inert (no install references them) and Claude Code has no command to prune them. |
| Public claim status | Mechanism works; **cost or success benefit is unproven.** A 4-task smoke eval passed 32/32 in both arms (agent cost per run $0.0031 with vs $0.0040 without); it is a smoke result, never write it up as savings. |

## What the product is

Public repo `cloud-f1/jev-agent-kit` (MIT). A Claude Code plugin that shortens long Bash output before the model sees it, always keeping the original recoverable. Unofficial; not affiliated with TypeSafe AI.

- **One native Mod**: `hooks/register.ts` (TypeScript, loaded directly, no build) + pure core `core/*.ts`. `hooks/hooks.json` contains only `"modules"`. The release gate rejects classic `hooks` entries. `$` is typed `EngineInterface`.
- **Requires Claude Code 2.1.287+.** On 2.1.271 to 2.1.286 the plugin loads but does nothing.
- **Everything is Node + TypeScript** (since 0.5.0). `cli/jev.ts` is the maintainer/eval CLI (imports the same `core/*.ts`), `scripts/release-check.ts` the gate, `scripts/gen-golden.ts` checks the frozen `tests/fixtures/golden.ts` (`--write` only after an intentional behavior change). Python was removed after a 178-comparison differential found 0 differences; the last Python version is tag `v0.4.0`. Node 22.18+ runs `.ts` directly; Node will not strip types inside `node_modules`, so the CLI runs from a checkout.
- **Commands in a session** (no model turn): `/jev status | doctor | savings | pane | readback <id> | preset <name> | init | on | off | mode` (`on|off|mode` work in an interactive session only; headless `claude -p` has no `/config` row for the plugin).
- **What it acts on**: Bash output between `minimumChars` (default 8,000) and about 29,700 characters. Claude Code cuts output at 30,000 before any hook runs, so output at that cut is left alone (`host_truncated_output`). The receipt names a file the model can read; reading it (or `/jev readback`) pauses rewriting for that project.
- **Settings**: `userConfig` in `.claude-plugin/plugin.json` shows in `/config` plus a sensitive API key in secure storage. Precedence: defaults < plugin settings < project file `.claude/jev-agent-kit.json`. A project cannot set the endpoint, key, credentials or model.
- **Key lookup**: `TYPESAFE_API_KEY` env, plugin setting, the *user* `settings.json` env block (never a project's), `JEV_ENV_FILE`.
- **Tests and gate**: 40 Node specs (`node --test cli/tests/*.spec.ts`), 109 Mod/core tests (`claude plugin test`), two `tsc` projects (`npm run typecheck`), plugin validate, golden check. `npm ci` once; plugin types come from Claude Code (it writes `.claude-plugin/types/` when a mod loads in an interactive session; git-ignored). No CI exists (no quota).
- **Evals**: `evals/` has four paired `claude plugin eval` cases ([`evals/README.md`](../evals/README.md)). Always pass `--no-publish` (the default publishes the report to claude.ai).

## File map

```
.claude-plugin/plugin.json, marketplace.json   manifest (userConfig lives here), single-plugin marketplace
hooks/register.ts                              ONLY file that calls the mods API ($)
hooks/hooks.json                               {"modules": ["./register.ts"]}
core/*.ts                                      pure: contracts, config (+settings layer), hash, prune
cli/jev.ts, io.ts, metrics.ts                  maintainer CLI; cli/tests/*.spec.ts are its node:test specs
scripts/release-check.ts, gen-golden.ts        local release gate; golden-fixture check
tests/*.test.ts                                Mod/core tests (claude plugin test); tests/fixtures/golden.ts frozen contract
evals/                                         paired claude-plugin-eval cases
skills/operate/SKILL.md                        shipped skill      .claude/skills/release, live-test   maintainer skills (project-only)
tsconfig.node.json, tsconfig.plugin.json       the two type-check projects (tsconfig.json at the root is generated by Claude Code and ignored)
docs/                                          PRD, EPICS, TESTING, PLAN-node-ts, EVALUATION, compatibility, sources, this file; REPO_HANDOVER and README.v0.1.zh-TW are v0.1 history
```

## Decisions the user made

- Repo `cloud-f1/jev-agent-kit`, public, MIT. Release skill is project-only; GitHub Actions removed (no quota).
- Core in TypeScript; Python retired in 0.5.0 (all Node + TypeScript). Python classic hook retired earlier; the plugin is Mod-only.
- Ideas taken from reading other repos, no code copied: fast-jev-compaction (visible failures, `settings.env` key, model setting) and quicksilver (see `sources.md`). Whole-session compaction: not building.
- Reference repos: `jev-harness` has no license (ideas only); MIT/BSD ones may be reused with notices (`sources.md`).
- Releases are automatic under the conditions in the table above.

## Traps already hit (do not rediscover)

- `defaultEnabled: false` in `plugin.json` makes a `--plugin-dir` load register no module and no hooks. The gate rejects it.
- An installed copy and a `--plugin-dir` copy share the name `jev-agent-kit`; disable or uninstall the installed one before scratch tests.
- `claude plugin test` runs every `*.test.ts` under the folder, so Node-only tests are `*.spec.ts` under `cli/tests/`. In Mod tests, register all stubs before the first call on `$`.
- The test host normalizes `fs.write` paths against the macOS cwd, so Windows-path assertions use `includes`, not `startsWith`.
- `$.fs` has no chmod, delete or mkdir; the POSIX path writes via `sh -c 'umask 077; ...'` with stdin, retention via `find`.
- **Claude Code truncates Bash output at 30,000 characters before any hook sees it and keeps the complete text in its own file.** Rewriting that head hid the tail from the model (found by the eval suite); the guard leaves such output alone.
- **The Jev backend only acts on small logs.** More than 96 non-pinned 8-line blocks or 60 KB per request returns the original untouched (`budget_fallback_original`); seen in a real session on a 27 KB log. Earlier Jev tests all used 320-line logs.
- **A model cannot run slash commands.** Anything the model must be able to do (read the original) has to be a path or a tool it has.
- `$.config.set` finds no `/config` row for the plugin in headless `claude -p`; it works interactively.
- `claude plugin eval` publishes its report to claude.ai unless `--no-publish`; it needs `--scaffold`, `--allow-tools Bash,Read` and `--trust-plugin` for these cases; each run uses a throwaway `HOME`.
- Interactive TUI testing with `expect` needs the user's explicit grant (the harness blocks it otherwise). Recipe: match the trust prompt with `Yes,.*trust`, send `\033OB` then `\r`, replace `sleep` with draining `expect` waits, send a command and its `\r` separately.
- The release gate's secret scan once silently skipped everything because an edit deleted `return files`; a test covers it. Secret-shaped fakes are allowed only under `tests/`, `cli/tests/` and `scripts/gen-golden.ts`.
- Installed plugins are cached by version: a fix reaches users only after bumping the version in **three** places (`core/contracts.ts`, `.claude-plugin/plugin.json`, `package.json`; the gate also checks the lockfile and the CHANGELOG heading).
- Live-test recipe: scratch project outside this repo, `--model haiku`, throwaway `JEV_STATE_DIR`, `--debug-file`, grep the log for `hooks module jev-agent-kit`.
- macOS has no `timeout`; zsh treats a bare `=====` as a command and expands `--include=*.md` (quote it).
- Commit identity is repo-local `cloud-f1 <cloud-f1@users.noreply.github.com>` on purpose (keeps the machine hostname out of public history).

## Jira

Project `JEV` on cloud-f1.atlassian.net mirrors [`EPICS.md`](EPICS.md): epics JEV-1 to JEV-9 and JEV-21, stories JEV-10 to JEV-20 and JEV-22 to JEV-28. Credentials live in `../symphony-workflow/.env` (never read or printed; use `uv run --env-file .env symphony-workflow call ...`). symphony-workflow cannot create projects, only issues and transitions. After a release, move the matching issues and update `EPICS.md`.

## Independent audits (all 2026-10-10)

One per release from 0.2.0 on, each by a fresh read-only agent; no unfixed high findings. The one high ever found (0.2.0): redaction let Bearer and JSON-quoted secrets reach the Jev API (fixed). Others fixed along the way: a project `settings.json` could supply the key; the pinned model was not required to answer as itself; `/jev savings` over-counting; `--env-file PATH` regression; the transport deadline not covering the body; a nonsense `BASH_MAX_OUTPUT_LENGTH` switching pruning off. Residual: `$.http.fetch` in the Mod may follow redirects (the key is only ever sent to the fixed endpoint). Details: [`CHANGELOG.md`](../CHANGELOG.md).

## Next steps

1. Decide JEV-29 with the user (split long logs into several requests, or accept the limit). Any change needs a live synthetic test, tests and an audit.
2. If the user supplies a budget: run the real paired benchmark ([`EVALUATION.md`](EVALUATION.md), JEV-14): many tasks, real repositories, several repeats, the Jev arm. Until then the honest status is "mechanism works, benefit unproven".
3. Run the Mod on a real Windows machine and fix what breaks (JEV-17).
4. Not yet seen: the sensitive-key prompt on enabling the plugin, `backend: jev` in an interactive session (headless is verified under the 96-block limit), a narrow terminal for the pane, a real compaction with fast-jev-compaction active.
5. Backlog ideas in [`sources.md`](sources.md) (shadow-mode comparison reports, a receipt that also counts lines, an `npx` bundle if ever wanted).
