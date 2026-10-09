# CLAUDE.md

Guidance for Claude Code working in `jev-agent-kit` (public repo, MIT). Read `docs/HANDOVER.md` first when picking up work.

## What this is

Claude Code plugin that prunes long Bash output (a native TypeScript Mod; Python is only the maintainer/eval CLI and the parity reference), optionally with the Jev model (TypeSafe AI). Safety and honesty matter more than features: it must fail open to the original output, and must never claim savings without agent-task evidence.

## Commands

```bash
uv run --no-project python -m unittest discover -s tests   # Python tests (no key, no network)
claude plugin test                      # TS core + Mod tests (offline; needs Claude Code 2.1.287+)
claude plugin validate --strict .       # manifests + Mod static analysis
uv run --no-project scripts/release_check.py   # full local gate; --release for tagging
uv run --no-project scripts/gen_golden.py      # regenerate shared fixtures after changing pruning/hashing
```

No CI: the local gate is the gate. Python is stdlib-only; do not add dependencies. Use the `release` skill (`.claude/skills/release`) to cut versions.

## Architecture rules

- `core/*.ts` is **pure**: no `$`, no I/O, no clock reads. Time, transport, storage are passed in.
- `hooks/register.ts` is the **only** file that calls the mods API. Mods API calls must be written in full (`$.ns.method`), event names string literals, helpers taking `$` must be top-level functions in the same file (`claude plugin validate` enforces; read its `calls:` line).
- Platform: the Mod must not need `sh`/`find`/`pwd` on Windows; every OS-specific branch is chosen by `isWindows($)` and covered by a stubbed test. Resolve paths with `$.fs.stat(path, {resolve: true}).realPath`. The Windows branch has never run on Windows; do not claim it works.
- Python `jevkit/core.py` is the reference implementation. TS must match it: `tests/fixtures/golden.{json,ts}` are generated from Python and checked from both sides. Change both cores together and regenerate.
- The Mod is the only thing that touches Bash output. Do not reintroduce classic `hooks` entries in `hooks/hooks.json` (the gate rejects it): two processors would double the cost and the risk. The old marker mechanism is gone.
- Plugin must NOT set `defaultEnabled: false` (a `--plugin-dir` load then registers nothing). Projects are opt-in via `.claude/jev-agent-kit.json` (`enabled` default false).
- Projects must never be able to set endpoint, key, credential paths or model (config validation rejects unknown fields; keep it that way). Read `settings.json` env with `$.settings.read({ source: 'user' })` only: the unfiltered merge includes a cloned repo's `.claude/settings.json`.
- A pinned model must answer as itself (`model_mismatch`); only `jev-latest` may resolve to another `jev-*` name. Both cores.

## Safety invariants (tests cover each; do not weaken)

- Any failure after the tool ran returns the original result unchanged.
- Never rewrite `stderr`, interrupted, image, failed (`isError`) or denied results.
- Error-bearing blocks are never dropped, with or without Jev.
- Records/logs never contain keys, response bodies, exception text, code, prompts or full logs; only fixed reason codes.
- Raw originals are written `0600` (umask 077). The goal text is redacted before leaving the machine.
- Jev endpoint is fixed; the key is read from env / `JEV_ENV_FILE` only; never from the repo.

## Working conventions

- Work on a branch; merge to `main`; release from clean `main`. Do not push or publish without the user's go-ahead (the repo is public).
- Never put a real key in the repo, chat, or tests (tests use obvious fakes). Never read `.env.local`.
- Verification claims: say exactly what ran. Mock/`log_proxy` results are not savings evidence; the live Jev API and long Agent-task benchmarks have **not** been run.
- Claude Code caches installed plugins by version: bump the version (`jevkit/core.py`, `core/contracts.ts`, `.claude-plugin/plugin.json`, `pyproject.toml`, plus CHANGELOG) for anything users must receive.
- `claude -p` live tests: use a scratch project outside this repo, `--model haiku`, a throwaway `JEV_STATE_DIR`, and disable any installed copy of the plugin (same-name plugins collide).
