# Jira board mirror (project JEV)

A snapshot of Jira status taken 2026-10-10, with the 0.8.0 closures (JEV-29, 35, 36, 47, 48 and epics E1, E4, E6) applied by hand on 2026-10-12; Jira is the source of truth. Structure is declared in [plan.json](plan.json) (story -> subtasks); the rules are in [../JIRA.md](../JIRA.md). Do not hand-edit statuses here.

10 epics, 38 stories/bugs/tasks, 144 subtasks.

## JEV-1 JEV-E1: Core pruning with read-back [Done]

| Story | Type | Status | Subtasks | Title |
|---|---|---|---|---|
| JEV-35 | Bug | Done | 5/5 | The default goal no longer drops quiet root-cause lines |
| JEV-37 | Story | Done | 3/3 | Pruning keeps the head, tail and error blocks, and the original can be read back |
| JEV-38 | Story | Done | 3/3 | Raw originals are stored privately and expire after the retention period |

## JEV-2 JEV-E2: Native TypeScript Mod [Done]

| Story | Type | Status | Subtasks | Title |
|---|---|---|---|---|
| JEV-39 | Story | Done | 3/3 | Bash results are wrapped by a native Mod, with no classic hook |
| JEV-40 | Story | Done | 3/3 | Every OS-specific branch is chosen in one place and covered by stubbed tests |

## JEV-3 JEV-E3: Settings and /jev commands [Done]

| Story | Type | Status | Subtasks | Title |
|---|---|---|---|---|
| JEV-41 | Story | Done | 3/3 | Settings are changed in the plugin settings form and a project file opts a project in |
| JEV-42 | Story | Done | 3/3 | /jev status, /jev doctor and /jev readback work inside a session |
| JEV-43 | Story | Done | 3/3 | A project cannot set the endpoint, key, credential paths or model |

## JEV-4 JEV-E4: Safety and audit [Done]

| Story | Type | Status | Subtasks | Title |
|---|---|---|---|---|
| JEV-34 | Bug | Done | 6/6 | Redaction masks common credential formats before anything is sent |
| JEV-47 | Story | Done | 4/4 | The Jev request refuses to go out when a block still looks secret-like after redaction |
| JEV-48 | Story | Done | 4/4 | Optional masking of personal data (email, ID numbers) behind a setting |

## JEV-5 JEV-E5: Visibility and key/model handling [Done]

| Story | Type | Status | Subtasks | Title |
|---|---|---|---|---|
| JEV-44 | Story | Done | 3/3 | A failed prune or Jev call is visible once per reason |
| JEV-45 | Story | Done | 3/3 | The API key is found in the environment, plugin settings, user settings.json or a key file |
| JEV-46 | Story | Done | 3/3 | The Jev model is a setting and records show the model that answered |

## JEV-6 JEV-E6: Live Jev validation [Done]

| Story | Type | Status | Subtasks | Title |
|---|---|---|---|---|
| JEV-10 | Story | Done | 4/4 | Jev API accepts our request (smoke test returns api_validated) |
| JEV-11 | Story | Done | 3/3 | The pinned Jev model answers as itself (jev-1.13.0) |
| JEV-12 | Story | Done | 4/4 | Live synthetic benchmark compares local rules and Jev |
| JEV-29 | Story | Done | 4/4 | Jev can see logs longer than 96 blocks (split across up to 4 requests, released in 0.8.0) |

## JEV-7 JEV-E7: Usability [Done]

| Story | Type | Status | Subtasks | Title |
|---|---|---|---|---|
| JEV-13 | Story | Done | 4/4 | Settings, project files and savings from the /jev prompt |
| JEV-20 | Story | Done | 4/4 | Interactive settings and the /jev pane are verified |
| JEV-31 | Task | Done | 5/5 | Config sources, key validation and write read-back are visible |
| JEV-32 | Task | Done | 5/5 | Patch releases 0.6.1 to 0.6.5 (docs, skills, messages, status honesty) |
| JEV-33 | Bug | Done | 3/3 | /jev doctor --verify works in a session (it was ignored) |

## JEV-8 JEV-E8: Evidence of benefit [In Progress]

| Story | Type | Status | Subtasks | Title |
|---|---|---|---|---|
| JEV-14 | Story | To Do | 0/5 | Paired agent-task benchmark shows whether the kit saves cost |
| JEV-15 | Story | Done | 4/4 | Shadow mode and pause-after-read-back protect task success |
| JEV-16 | Story | Done | 3/3 | Pruned output carries a measured, readable receipt |
| JEV-36 | Task | Done | 6/6 | Quiet-line retention is measured and 0.8.0 ships the fixes |

## JEV-9 JEV-E9: Platform and maintainability [In Progress]

| Story | Type | Status | Subtasks | Title |
|---|---|---|---|---|
| JEV-17 | Story | To Do | 0/4 | The Mod runs on a real Windows machine |
| JEV-18 | Story | Done | 4/4 | The Mod and CLI type-check with Claude Code's real types |
| JEV-19 | Story | Done | 4/4 | Repeated warning lines collapse without losing errors |

## JEV-21 JEV-E10: Node + TypeScript alignment [Done]

| Story | Type | Status | Subtasks | Title |
|---|---|---|---|---|
| JEV-22 | Story | Done | 3/3 | The repo is Node and TypeScript only (package setup) |
| JEV-23 | Story | Done | 4/4 | The maintainer CLI runs in TypeScript |
| JEV-24 | Story | Done | 3/3 | The release gate and golden check run in TypeScript |
| JEV-25 | Story | Done | 3/3 | The tests run on node:test with a parity proof |
| JEV-26 | Story | Done | 4/4 | Python is removed and the docs match |
| JEV-27 | Story | Done | 4/4 | Interactive behaviour is verified with an expect script |
| JEV-28 | Story | Done | 4/4 | The Mod uses Claude Code's real types, not any |
| JEV-30 | Bug | Done | 4/4 | CLI help works and Node 22.6 to 22.17 can run it |
