---
name: release
description: Cut a jev-agent-kit release. Use when the user says release, publish, tag, bump version, or ship a new version of this repo. Project-only skill (not shipped to plugin users).
---

# Release jev-agent-kit

Installed plugins are cached **by version**: users only get a fix after the version string changes. Never push a behavior change without bumping.

## Procedure (stop at the first failure; never skip a step)

1. **Branch state**: work on a branch, merge to `main` first. Releases are cut from a clean `main`.
2. **Bump the version in all four places**: `jevkit/core.py` (`VERSION`), `core/contracts.ts` (`VERSION`), `.claude-plugin/plugin.json` (`version`), `pyproject.toml` (`version`). The gate fails if any differ.
3. **Changelog**: keep the `Version history` table at the top current and add `## X.Y.Z (YYYY-MM-DD)` at the top of `CHANGELOG.md`, grouped as fixed / changed / new / not done. Distinguish bug fixes from changes to questions, thresholds, models or data sent (those change behavior; say so).
4. **Regenerate fixtures if pruning/hashing changed**: `uv run --no-project scripts/gen_golden.py`, review the diff.
4b. **Audit before release**: for any change to key handling, network, redaction or response validation, have a fresh read-only agent audit `git diff main..<branch>` (give it the code, not your conclusions), fix findings with a regression test, and mutate the fix once to see the test fail. If response validation changed, run `uv run --no-project jev.py smoke` once with the user's go-ahead before tagging.
5. **Gate**: `uv run --no-project scripts/release_check.py --release`. It must print `OK to proceed`. A `SKIPPED` line is a failure (a check that could not run proves nothing).
6. **Tag and publish** (ask the user first unless they just approved this release; this is public). Also keep `docs/PRD.md`, `docs/EPICS.md`, `docs/HANDOVER.md` and README test counts in step:
   `git tag vX.Y.Z && git push origin main --tags && gh release create vX.Y.Z --title vX.Y.Z --notes-file <changelog excerpt>`
7. **Post-release verification from the real marketplace** in a scratch project:
   `claude plugin marketplace add cloud-f1/jev-agent-kit --scope local`, `claude plugin install jev-agent-kit@jev-agent-kit --scope local`, then confirm the version with `claude plugin list` and run `claude -p "/jev doctor"` there. Remove with `claude plugin uninstall` and `claude plugin marketplace remove`.
7b. **Jira**: move the matching JEV issues (see `docs/EPICS.md`) with `symphony-workflow call transition_issue` from `../symphony-workflow` (`uv run --env-file .env ...`); never print its `.env`.
8. **Rollback**: users pin by reinstalling the previous tag; fix forward with a new patch version. Never move or delete a published tag.

## Rules

- No secrets in commits (the gate scans tracked files). The Jev key lives only in a local `.env.local`.
- Do not use `defaultEnabled: false` in `plugin.json`: a `--plugin-dir` load then registers no module and no hooks (verified on Claude Code 2.1.295). The gate rejects it.
- Do not claim cost savings in release notes without agent-task evidence (`docs/EVALUATION.md`).
- Live Jev and real-session checks need the user's key/session; say plainly what was not run.
