# Reference projects: what we may reuse

Checked 2026-10-10 with `gh api` (license, HEAD SHA, last push). **fast-jev-compaction was read at source level (hooks/fast-jev.ts, src/request.ts, manifests, tests) and loaded once in a scratch project; the others were README-level only.** Treat the "idea" column as inspiration; do not copy code until its source file has been read and its license obligations met.

| Project | License | HEAD | Last push | May we reuse code? | Essence worth taking |
|---|---|---|---|---|---|
| [typesafe-ai/typesafe-sdk-js](https://github.com/typesafe-ai/typesafe-sdk-js) | MIT | 66880ccded6c | 2026-09-15 | Yes, keep the MIT notice | Typed request/answer shapes; use in a future Node CLI (a Mod cannot import npm packages) |
| [typesafe-ai/skills](https://github.com/typesafe-ai/skills) | MIT | 65a39f393687 | 2026-09-12 | Yes, keep the MIT notice | Official skill wording for API usage; cross-check our `skills/operate` against it |
| [dr-dimitru/claude-jev-plugin](https://github.com/dr-dimitru/claude-jev-plugin) | BSD-3-Clause | bd5c8aed11c3 | 2026-09-29 | Yes, keep copyright notice + license text | Shadow mode (decide but never act), fixed local failure advice, no-verdict is never "clear", project config cannot change endpoint |
| [NiazMorshed2007/jev-review](https://github.com/NiazMorshed2007/jev-review) | MIT | 57690af54ef7 | 2026-09-17 | Yes, keep the MIT notice | Multi-dimension quality signals; main agent does the fixing; compare before/after |
| [tamaratran/fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) | MIT | e3f262a7f4d4 | 2026-09-18 | Yes, keep the MIT notice | Keep the original, thin adapter, fall back to the stock behavior. Written against older Mod types; do not assume its compaction API still exists |
| [TranBaVinhSon/jev-harness](https://github.com/TranBaVinhSon/jev-harness) | **none** | 113b44d853b2 | 2026-09-23 | **No.** No license means all rights reserved | Ideas only: spill-to-file, at most one escalation, separate "cheap model" from "Jev" in the benchmark |
| [v-modal/awesome-jev-tools](https://github.com/v-modal/awesome-jev-tools) | none | f085a147dc12 | 2026-10-09 | Index only | Discovery of new adapters; entry counts and stars are not quality evidence |

## Rules we follow

- Ideas are free; code needs a license. Only MIT and BSD-3 sources above may be copied from, with their notices kept in the file or in `THIRD_PARTY_NOTICES.md`.
- Nothing has been copied so far. If something is, record the source path, commit SHA and license here in the same commit.
- Stars and README claims are not evidence that an approach lowers cost. Only our own paired agent-task runs are (`docs/EVALUATION.md`).

## fast-jev-compaction: what we took and what we did not (read 2026-10-10, commit e3f262a)

Taken as ideas (v0.2.1), no code copied: visible fallback toasts and per-decision debug log; key from `settings.json` env; a `model` setting and `jev-latest`.
Deliberately not copied: it puts the first 200 characters of an API error body into messages (we show fixed reason codes only); it does not range-check probabilities or validate usage (we do); whole-session compaction (a different, larger feature; use that project alongside ours).
Still open: it checks in Claude Code's `claude-code.d.ts` and runs `tsc` over its hook (needs Node for maintainers); we use `any`.

## Concrete adoption backlog (not done)

1. **Shadow mode** (from claude-jev-plugin): a mode that calls Jev and records what it *would* have done, never rewriting. Our `observe` already records, but only for the local rules decision; extending it to log the Jev decision gives the data to calibrate `keepThreshold`.
2. **Quality gate on our own output** (from jev-review): after `assist` pruning, verify the fixed evidence (error lines) survived; count `readback` calls as a cost signal.
3. **Escalation at most once** (from jev-harness, idea only): if the model reads back the original, stop pruning that command for the session.
4. **Official SDK in a Node CLI** (from typesafe-sdk-js): a second distribution path; the Mod keeps using `$.http`.
