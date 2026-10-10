# Eval cases (`claude plugin eval`)

Four small paired cases (plugin vs no plugin) for the Bash-output pruner. They are a smoke suite for the mechanism, **not** a benchmark: synthetic logs, one cheap model, a handful of runs.

| Case | What it checks |
|---|---|
| `error-line-in-long-log` | an error line in a ~17 KB log is still found when pruned |
| `warning-heavy-log` | a ~25 KB log of mostly repeated warnings, one real error |
| `needle-not-an-error-negative-control` | the answer is a plain non-error line: the case that exposed a real failure (the model could not recover what pruning dropped) |
| `error-beyond-host-cap-regression` | a ~60 KB output beyond Claude Code's 30,000-character cut: the plugin must leave it alone |

Each case's `setup.sh` writes a project opt-in file into the throwaway workspace (`assist`, local rules, no network) so the plugin acts.

```bash
claude plugin eval . --scaffold --allow-tools Bash,Read --no-publish \
  --max-cost-usd 3 --runs 8 --concurrency 3 --model haiku --trust-plugin \
  --output-dir /some/scratch/dir --json /some/scratch/dir/out.json
```

- **Always pass `--no-publish`**: by default the HTML report (prompts, outputs) is published to claude.ai.
- `--scaffold` runs `setup.sh` as you and `--allow-tools Bash` lets the agent run the command in each case; only use them on cases you wrote. `--trust-plugin` asserts you trust this repo's code.
- `--keep-temp` keeps each run's trace (`tracePath` in the JSON) if you need to see what the model was shown.
- Only the agent's own cost is reported. Cases use the local rules backend, so there is no Jev cost; a Jev arm would need its own cases and a budget.

Results so far are in CHANGELOG 0.6.0. The paired benchmark of `docs/EVALUATION.md` (many more tasks, real repositories, several repeats, the Jev arm) has not been run.
