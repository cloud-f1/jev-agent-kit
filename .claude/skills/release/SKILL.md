---
name: release
description: Cut a jev-agent-kit release. Use when the user says release, publish, tag, bump version, or ship a new version of this repo. Project-only skill (not shipped to plugin users).
---

# Release jev-agent-kit

Installed plugins are cached **by version**, and an installed copy is the whole repository at the tag (skills, README, `docs/TESTING.md` included). So users get a fix, or a documentation correction, only after the version string changes. Never push a behavior change without bumping.

## Prerequisites (once per machine)

- Node 22.18+ and `npm ci` (typescript and @types/node are the only dependencies, dev-only).
- Claude Code's generated types in `.claude-plugin/types/`: Claude Code writes them (and a root `tsconfig.json`, git-ignored) when a mod loads in an **interactive** session. Without them the plugin type-check step is SKIPPED, which fails a `--release` gate.

## Procedure (stop at the first failure; never skip a step)

1. **Branch state**: work on a branch, merge to `main` (fast-forward) first. Releases are cut from a clean `main`.
2. **Bump the version in four files**: `core/contracts.ts` (`VERSION`), `.claude-plugin/plugin.json` (`version`), `package.json` (`version`) and `package-lock.json` (top-level `version` and `packages[""].version`). The gate checks all of them plus the top CHANGELOG heading and fails if any differ.
3. **Changelog**: keep the `Version history` table at the top current and add `## X.Y.Z (YYYY-MM-DD)` at the top of `CHANGELOG.md`, grouped as fixed / changed / new / not done. Distinguish bug fixes from changes to thresholds, models, questions or data sent (behavior changes; say so). State exactly what code changed (for a docs-only release: that `hooks/` and `core/` differ only in the version string, checked with `git diff vPREV -- hooks core`).
4. **Regenerate fixtures only for an intentional behavior change**: `node scripts/gen-golden.ts --write`, review the diff. Without `--write` it only checks the frozen contract.
5. **Audit every release**: a fresh read-only agent audits `git diff vPREV..<branch>`; give it the code and the invariants in `CLAUDE.md`, not your conclusions. For a docs-only release it audits the docs against the code. Fix findings with a regression test and mutate the fix once to watch the test fail. If response validation, key handling, network or redaction changed, run `node cli/jev.ts smoke` once (synthetic sentence) before tagging.
6. **Live-test what changed** with the `live-test` skill (headless commands; paired evals for behavior that affects what the model sees). Docs that describe behavior (`docs/TESTING.md`) must be written from observed behavior; walk them.
7. **Align the docs**: `docs/PRD.md`, `docs/EPICS.md`, `docs/HANDOVER.md`, `docs/compatibility.md`, `docs/TESTING.md`, the README (status, test counts, documentation map) and the operate skill all describe the same release. Do not copy test counts forward: read them from the gate output.
8. **Gate**: `node scripts/release-check.ts --release` must print `OK to proceed`. Steps: versions agree, changelog dated, manifests, secrets scan, markdown links (git-tracked targets), clean main, Node tests (zero or skipped tests fail), Mod tests, golden fixture, two `tsc` projects, plugin validate. A `SKIPPED` line is a failure.
9. **Tag and publish** (see Standing approval): `git tag vX.Y.Z && git push origin main --tags && gh release create vX.Y.Z --title vX.Y.Z --notes-file <changelog excerpt>`.
10. **Verify from the real marketplace** in a scratch folder: `claude plugin marketplace add cloud-f1/jev-agent-kit --scope local` (or `marketplace update`), `claude plugin install jev-agent-kit@jev-agent-kit --scope local`, `claude -p "/jev doctor"` shows the new version, then walk `docs/TESTING.md` steps 1 to 8. **Then uninstall the test install** (`claude plugin uninstall jev-agent-kit@jev-agent-kit --scope local` from that folder) and confirm `claude plugin list --json` has no `jev-agent-kit`. Old version folders under `~/.claude/plugins/cache/jev-agent-kit/` are inert; there is no prune command for them.
11. **Jira**: move the matching JEV issues (see `docs/EPICS.md`) with `symphony-workflow call transition_issue` from `../symphony-workflow` (`uv run --env-file .env ...` there; that sibling project is Python). Statuses: To Do, In Progress, In Review, Done. Never print its `.env`. Comment on a ticket that stays open with what was and was not done.
12. **Rollback**: users pin by reinstalling the previous tag; fix forward with a new patch version. Never move or delete a published tag.

## Upgrade rule (users must not have to reconfigure)

Plugin settings live in the user's `settings.json` under `pluginConfigs["jev-agent-kit@<marketplace>"]`, keyed by plugin, not version. Keep that true: never rename or remove a `userConfig` key, never add a required option without a `default`, never change a project-file field's meaning. A release that must break this needs a changelog warning and the user's explicit go-ahead. Not yet verified across a real version upgrade; check it once with the next release (install the old version with settings, update, run `/jev doctor`).

## Standing approval (given by the user on 2026-10-10)

Releases may be done automatically: merge to `main`, tag, push, GitHub release, marketplace check, and moving the matching Jira tickets, **only when** the fresh read-only audit has no unfixed high finding and `release-check.ts --release` prints `OK to proceed`. Still stop and ask for: a failing gate or a high finding you cannot fix, deleting or moving a published tag, any call that sends real project data (not synthetic) to a third-party API, and any wording that claims cost or success benefit. Say afterwards exactly what ran and what did not.

## Rules

- No secrets in commits (the gate scans tracked files). The Jev key lives only in the environment or a local `.env.local`; never read or print it.
- Do not use `defaultEnabled: false` in `plugin.json`: a `--plugin-dir` load then registers no module and no hooks. The gate rejects it.
- Do not claim cost savings or higher success in release notes. The only numbers so far are a 4-task smoke eval (`evals/`); the real benchmark (`docs/EVALUATION.md`, Jira JEV-14) has not been run.
- `claude plugin eval` publishes its report to claude.ai unless `--no-publish`. Always pass it.
- Live Jev and interactive checks need the user's key or grant; say plainly what was not run (see "Not verifiable here" in the `live-test` skill).
