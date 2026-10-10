# Jev Agent Kit

A [Claude Code](https://claude.com/claude-code) plugin that shortens long `Bash` output before the model reads it. It uses local rules, and can optionally ask the [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev) model (TypeSafe AI) which parts matter. The full original is always kept, so nothing is lost.

Unofficial community project, not affiliated with TypeSafe AI. MIT licensed.

> **Status: v0.7.0. The mechanism works; the benefit is unproven.** In tests, long synthetic logs shrink a lot and error lines are kept. Whether it lowers your total cost per *successful* task has **not** been measured. Treat it as an experiment and see [Is it worth it?](#is-it-worth-it).

## How it works

```
Bash runs -> long output (8,000 to ~29,700 chars) -> kit shortens it -> the model reads the short version
                                                    \-> the full original is saved; one line tells the model where
```

- It keeps the start, the end, and every block with an error, warning or traceback. Error lines are never dropped, with or without Jev.
- It never touches `stderr`, failed or denied commands, images, or output Claude Code already cut at 30,000 characters.
- If anything goes wrong, you get the original output unchanged.
- Nothing happens until a project **opts in**.

## Install

Needs Claude Code **2.1.287 or later**.

```
/plugin marketplace add cloud-f1/jev-agent-kit
/plugin install jev-agent-kit --marketplace cloud-f1/jev-agent-kit
```

The install opens a settings form. You can leave everything at its default and skip the API key.

**Updates.** Claude Code does the updating; a plugin cannot update itself, and this one never checks the network for new versions.
- **Automatic** (per the Claude Code docs): auto-update is **off by default for third-party marketplaces**. Turn it on in `/plugin` → Marketplaces → jev-agent-kit → Enable auto-update. Claude Code then checks after your first message in a session (after a random delay of up to 10 minutes), shows "Plugin updated ... Run /reload-plugins", and loads the new version on the next launch.
- **By hand:** `claude plugin update jev-agent-kit@jev-agent-kit`, then restart or run `/reload-plugins`.
- **Your data:** project files (`.claude/jev-agent-kit.json`) are never touched by an update. Claude Code does not document whether saved plugin settings survive an update, and we have not tested a real upgrade; if a setting looks reset, run `/jev doctor` and set it again. This project's rule is never to rename or remove a setting, or add a required one.
- `/jev doctor` shows the version you are running and these steps.

## Try it in five minutes (safe, free, nothing leaves your machine)

1. In your project, run `/jev preset observe-local`. This creates `.claude/jev-agent-kit.json`.
2. Run `/jev doctor` and check it says the project is opted in.
3. Run something that prints a lot (a long test run), then `/jev status`. You will see a record, and the output you saw was **not changed**.
4. Happy? Switch to pruning: delete the file and run `/jev preset prune-local`. The model now sees the short version plus a note naming the file with the full original.
5. See the effect with `/jev savings` (counted characters only) or `/jev pane` (a side pane).

Want the Jev model too? See [Using Jev](#using-jev-optional-costs-money) first.

## What leaves your machine

| `backend` | Sent to TypeSafe's API? |
|---|---|
| `rules` (default) | **Nothing.** Everything is local. |
| `jev` | **Yes.** Redacted log blocks, a short goal line and your API key go to `https://api.typesafe.ai`, in both `observe` and `assist`. |

`mode` only decides whether the output you see is changed: `observe` records only, `assist` rewrites.

## Using Jev (optional, costs money)

1. Get a key at [console.typesafe.ai](https://console.typesafe.ai). Never paste it into a chat or commit it.
2. Save it: `claude plugin configure jev-agent-kit` (kept in secure storage), or set `TYPESAFE_API_KEY`.
3. Check it works: run `/jev doctor --verify` (sends one synthetic sentence, nothing from your project; prints `valid`, `invalid (401)` or `missing`). Plain `/jev doctor` only says a key is present, it does not check it. The key can come from your shell, your user `settings.json` `env` block (Claude Code applies it to its own environment, so it shows as "environment") or the plugin's secure setting.
4. Start with `/jev preset shadow-jev`: it asks Jev and records what it would keep, but never changes your output.

Limits worth knowing:
- Jev only sees logs of roughly 8,000 to 14,000 characters (up to 96 blocks / 60 KB per request). Longer logs are **not sent** and come back unchanged.
- A log where every block contains an error or warning word is never sent either. To see Jev answer in a real session, the log needs ordinary lines as well as error lines, and must stay under the limit above. `/jev status` and `/jev savings` say "Jev not asked" for those, so they say nothing about Jev.

## Is it worth it?

Shorter output is not the goal. Lower cost per successful task at the same success rate is. The kit gives you three levels of evidence:

| Level | What to do | Tells you |
|---|---|---|
| Free, a week | Keep `observe` on. Read `/jev savings`, `/jev status` and the fall-back reasons. | How much output is long enough to matter, and how often fall-backs happen. Not whether answers get better. |
| Cheap | Use `prune-local` on a few real tasks. Watch for the model reading the original back (the kit pauses pruning after a read-back). | Whether the short version is enough in practice. |
| Real verdict | Paired runs: no plugin vs rules vs Jev, same tasks, your own verifier. See [docs/EVALUATION.md](docs/EVALUATION.md) and [evals/README.md](evals/README.md). | The only thing that can show a net saving. |

## Commands

| Command | Does |
|---|---|
| `/jev doctor [--verify]` | Version, effective settings and where each came from, key present or not, what to do next. `--verify` also checks the key with one synthetic sentence. |
| `/jev status` | Record count, the last 10 decisions, failed-command repeats. |
| `/jev savings` | Counted characters removed (or that `assist` would remove), and how many logs Jev really answered. Not a token or cost claim. |
| `/jev pane` / `/jev pane close` | A side pane with savings and recent decisions. |
| `/jev readback <id>` | Print the untouched original. |
| `/jev preset <name>` | Create the project file: `observe-local`, `shadow-jev`, `prune-local`, `prune-jev`. Never overwrites. |
| `/jev init [observe\|assist]`, `/jev on`, `/jev off`, `/jev mode <m>` | Create the file, or change your settings (interactive sessions only). |

If a project file exists, its fields win over `/jev mode` and the settings form. To switch, edit the file or delete it and run a preset.

## Settings

Open `/plugin` → Installed → Jev Agent Kit → Configure, or edit `.claude/jev-agent-kit.json` in a project (the file wins).

| Setting | Default | Meaning |
|---|---|---|
| `enabled` (form: "Enable in every project") | off | Must be on, or the project file must say `true`. |
| `mode` | `observe` | `observe` records only; `assist` rewrites output. |
| `backend` | `rules` | `rules` is local; `jev` adds the API pass. |
| `minimumChars` | 8000 | Shorter output is never touched. |
| `keepThreshold` | 0.8 | How sure Jev must be to keep a block. |
| `retentionDays` | 7 | How long originals and records are kept. |
| Jev model | `jev-1.13.0` | Pinned on purpose; `jev-latest` follows the newest. |

Everything else (all settings in detail, the key lookup order, storage, the CLI, evaluation, other platforms) is in [docs/REFERENCE.md](docs/REFERENCE.md).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/jev` not found | Update Claude Code (2.1.287+) and restart. |
| Nothing is pruned | Run `/jev doctor`: is the project opted in? Is the output over `minimumChars`? Is `mode` still `observe`? |
| `/jev mode assist` changed nothing | A project file field wins. Edit it, or delete it and run `/jev preset prune-local`. |
| `backend: jev` but the log is not shortened | Over 96 blocks (about 800 short lines): not sent. Or every block was an error/warning, so Jev was not asked. |
| A reason other than `ok` in `/jev status` | That is why the original was used (`missing_key`, `http_429`, `timeout`...). It also appears once as a notice. |
| Stop it | One project: set `"enabled": false`. Everywhere: `claude plugin disable jev-agent-kit`. |

## Limits

Not a security control, and secret redaction is best effort. Raw originals may contain secrets and are stored `0600` in `~/.cache/jev-agent-kit/`. Windows has never been run. Jev is early access and English-first. A small 4-task smoke test passed in both arms at about the same cost; that is not evidence of a benefit.

## More

| Read this | For |
|---|---|
| [docs/REFERENCE.md](docs/REFERENCE.md) | Full detail: how pruning works, settings, key, CLI, privacy, evaluation, development |
| [docs/TESTING.md](docs/TESTING.md) | 14-step tester checklist (Traditional Chinese) |
| [docs/compatibility.md](docs/compatibility.md) | What was actually run, and what was not |
| [CHANGELOG.md](CHANGELOG.md) | What changed in each version |
| [docs/PRD.md](docs/PRD.md), [docs/EPICS.md](docs/EPICS.md) | Purpose, requirements, epics (mirrored in Jira project JEV) |
| [CLAUDE.md](CLAUDE.md), [docs/HANDOVER.md](docs/HANDOVER.md) | Rules and current state for contributors |
| [docs/PLAN-node-ts.md](docs/PLAN-node-ts.md), [docs/sources.md](docs/sources.md) | The Node + TypeScript decision; other projects reviewed |
| [skills/operate/SKILL.md](skills/operate/SKILL.md), [examples/project-config.json](examples/project-config.json) | The skill shipped to users; an example project file |
| [docs/REPO_HANDOVER.md](docs/REPO_HANDOVER.md), [docs/README.v0.1.zh-TW.md](docs/README.v0.1.zh-TW.md), [SESSION.md](SESSION.md), [VALIDATION.md](VALIDATION.md) | v0.1 history (Python era); their commands no longer exist |
