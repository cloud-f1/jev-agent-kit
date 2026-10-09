# Compatibility and verification status

Updated 2026-10-10. Records what was actually run, and what was not.

| Item | Status | Evidence |
|---|---|---|
| Python core, CLI, 26 unit/subprocess-hook tests | Passed | Python 3.14.4, macOS arm64 (`python3 -m unittest discover -s tests`) |
| Python 3.10 / 3.11 / 3.12 | CI matrix | `.github/workflows/ci.yml` (see Actions run on the repo) |
| Offline `bench-logs` (mock Jev) | Ran | Synthetic fixtures only; not a Jev quality or billing result |
| `claude plugin validate --strict` | Passed | Claude Code 2.1.295 |
| Hook output schema vs docs | Read, matches | `PostToolUse` `hookSpecificOutput.updatedToolOutput` must equal the Bash shape (`stdout`, `stderr`, `interrupted`, `isImage`); `PostToolUseFailure` error text is `error` |
| Plugin load in a real session (`/hooks`, real long Bash output) | **Not run** | Needs an interactive session; see below |
| Marketplace install from GitHub | **Not run** | Only valid after the repo is pushed |
| Live Jev API (`smoke`, `bench-logs --live`) | **Not run** | Needs `TYPESAFE_API_KEY` in a local `.env.local` |
| Native Mod, model routing | Not implemented | Planned for v0.2+ |
| Real Agent-task benchmark | Not run | See `docs/EVALUATION.md`; needs a budget decision |

## Manual host check (interactive)

1. `claude --plugin-dir /absolute/path/to/jev-agent-kit` in a scratch project that has `.claude/jev-agent-kit.json` with `"enabled": true, "mode": "observe", "backend": "rules"`.
2. `/hooks` should list `PostToolUse` and `PostToolUseFailure` for `Bash`.
3. Run a Bash command that prints more than `minimumChars` characters; then `python3 jev.py status --project <scratch project>` should show a record.
4. Only after that, try `"mode": "assist"` and confirm the model sees the pruned output with a read-back ID.
