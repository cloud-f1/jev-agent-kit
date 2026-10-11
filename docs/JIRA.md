# Jira (project JEV)

Project **JEV** at https://cloud-f1.atlassian.net/browse/JEV, team-managed software. The board is a mirror of the work in this repo; [EPICS.md](EPICS.md) explains each epic and [jira/board.md](jira/board.md) is a dated snapshot of every card.

## Hierarchy: Epic -> Story -> Subtask (mandatory)

Adopted on 2026-10-10 from `course-crm`'s `.claude/rules/jira-hierarchy.md` and now implemented in `symphony-workflow` (`docs/JIRA_HIERARCHY.md` there; branch `feat/jira-hierarchy-audit`). Before this, none of the 26 stories had a subtask, and bugs and tasks hung directly under epics.

| Layer | Issue type | Naming | Size |
|---|---|---|---|
| Epic | Epic | `JEV-E<n>: <outcome>` | a direction the owner cares about; 3 to 8 stories |
| Story | Story (a Bug or Task at the same level is fine) | a noun phrase: what changes for the user | one pull request, or one tightly related batch |
| Subtask | Subtask | verb-first, concrete, testable | an hour or two; 2 to 6 per story |

Rules:

1. Every story has subtasks, created with the story. The **last subtask is the tests** (`Tests: ...`).
2. Done-when: a subtask is done when its piece is committed or verified; a story when its change is **released** (merged and tagged for anything users receive) and all its subtasks are Done; an epic when every story is Done. A Done story's open subtasks go Done with it (roll-up).
3. **Every ticket is assigned to alex hsieh** (never Unassigned), has its parent, defaults to priority Medium (High for a privacy or safety bug), is written in English so a developer or another Claude session can start from it, and is one finding per ticket. No real keys in a ticket.
4. Work that is only done on an unreleased branch stays In Progress with an open "Release ..." subtask until the release (see the release cadence policy in the `release` skill).
5. Branches and commits carry the story key where there is one; a release comment links the GitHub release.

## Tools

The structure lives in [jira/plan.json](jira/plan.json) (`{story key: [subtask summaries]}`). Commands come from `symphony-workflow` (run from its checkout; credentials are its `.env`, never printed):

```bash
symphony-workflow audit JEV --assignee-me          # 0 errors expected; exit 1 lists what breaks the rules
symphony-workflow add-subtasks plan.json --dry-run # then without --dry-run; idempotent
symphony-workflow rollup <subtask-key>             # close the story/epic when its children are done
```

Creating a ticket (the symphony tool cannot set assignee or a parent on an existing issue): one REST call with `parent`, `assignee` (the `accountId` from `GET /rest/api/2/myself`) and `priority`. Check afterwards that the audit still prints 0 errors.
