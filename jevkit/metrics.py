"""Paired task-level report. Missing/unknown costs never become free runs."""
import json
import math
import random
import statistics
from pathlib import Path

def percentile(values, p):
    ordered = sorted(values)
    return ordered[max(0, math.ceil(p * len(ordered)) - 1)] if ordered else None

def cost_per_success(rows):
    passes = sum(r['success'] for r in rows)
    return sum(r['agent_cost_usd'] + r['jev_cost_usd'] for r in rows) / passes if passes else None

def summarize(rows):
    return {'attempted_tasks': len(rows), 'passed_tasks': sum(r['success'] for r in rows),
            'pass_rate': statistics.mean(r['success'] for r in rows),
            'first_pass_rate': statistics.mean(r['first_pass'] for r in rows),
            'observed_total_cost_usd': sum(r['agent_cost_usd'] + r['jev_cost_usd'] for r in rows),
            'cost_per_success_usd': cost_per_success(rows),
            'p50_wall_seconds': percentile([r['wall_seconds'] for r in rows], .5),
            'p95_wall_seconds': percentile([r['wall_seconds'] for r in rows], .95),
            'mean_retries': statistics.mean(r['retries'] for r in rows),
            'cost_complete': all(r['cost_complete'] for r in rows)}

def report(manifest, rows, draws=2000):
    tasks = manifest['task_ids']
    arms = manifest['arms']
    repeats = manifest['repeats']
    baseline = manifest['baseline']
    if not tasks or len(set(tasks)) != len(tasks) or len(set(arms)) != len(arms) or baseline not in arms or type(repeats) is not int or repeats < 1:
        raise ValueError('invalid_manifest')
    expected = {(t, i, a) for t in tasks for i in range(repeats) for a in arms}
    keyed = {}
    for row in rows:
        if row.get('record_type') != 'agent_task' or row.get('experiment_id') != manifest['experiment_id']:
            raise ValueError('wrong_record_type_or_experiment')
        key = (row.get('task_id'), row.get('repeat'), row.get('arm'))
        if key not in expected or key in keyed:
            raise ValueError('unexpected_or_duplicate_run')
        for name in ('success', 'first_pass', 'cost_complete', 'evidence_guard_passed'):
            if type(row.get(name)) is not bool:
                raise ValueError('invalid_' + name)
        if row['first_pass'] and not row['success']:
            raise ValueError('inconsistent_first_pass')
        for name in ('agent_cost_usd', 'jev_cost_usd', 'wall_seconds', 'retries'):
            value = row.get(name)
            if type(value) not in (int, float) or not math.isfinite(value) or value < 0:
                raise ValueError('invalid_' + name)
        if type(row['retries']) is not int or type(row['repeat']) is not int:
            raise ValueError('invalid_integer')
        for name in ('seed_revision', 'verifier_revision', 'environment_id', 'runtime_version', 'model_id'):
            if not isinstance(row.get(name), str) or not row[name]:
                raise ValueError('missing_' + name)
        keyed[key] = row
    missing = sorted(expected - set(keyed))
    if missing:
        return {'status': 'INCOMPLETE', 'missing_runs': missing,
                'reason': 'Include failures, timeouts and aborted runs; do not discard them.'}
    for task in tasks:
        group = [keyed[(task, i, arm)] for i in range(repeats) for arm in arms]
        for name in ('seed_revision', 'verifier_revision', 'environment_id', 'runtime_version'):
            if len({r[name] for r in group}) != 1:
                raise ValueError('unpaired_' + name)
        if not manifest.get('allow_model_variation', False) and len({r['model_id'] for r in group}) != 1:
            raise ValueError('unpaired_model_id')
    by_arm = {arm: [keyed[(t, i, arm)] for t in tasks for i in range(repeats)] for arm in arms}
    summaries = {arm: summarize(v) for arm, v in by_arm.items()}
    comparisons = {}
    rng = random.Random(20261009)
    gates = manifest.get('gates', {})
    min_tasks = gates.get('minimum_unique_tasks', 100)
    min_repeats = gates.get('minimum_repeats', 3)
    base = summaries[baseline]
    for arm in arms:
        if arm == baseline:
            continue
        target = summaries[arm]
        # Cluster bootstrap by task, retaining every repeat and matched arm.
        pass_deltas, ratios = [], []
        for _ in range(draws):
            sampled = [rng.choice(tasks) for _ in tasks]
            left = [keyed[(t, i, baseline)] for t in sampled for i in range(repeats)]
            right = [keyed[(t, i, arm)] for t in sampled for i in range(repeats)]
            pass_deltas.append(statistics.mean(r['success'] for r in right) - statistics.mean(r['success'] for r in left))
            lc, rc = cost_per_success(left), cost_per_success(right)
            if lc is not None and lc > 0 and rc is not None:
                ratios.append(rc / lc)
        ci = lambda values: [percentile(values, .025), percentile(values, .975)] if values else [None, None]
        ratio_ci, pass_ci = ci(ratios), ci(pass_deltas)
        ratio = target['cost_per_success_usd'] / base['cost_per_success_usd'] if base['cost_per_success_usd'] and target['cost_per_success_usd'] is not None else None
        latency_ratio = target['p95_wall_seconds'] / base['p95_wall_seconds'] if base['p95_wall_seconds'] else None
        status = 'INSUFFICIENT_EVIDENCE'
        if not all(r['evidence_guard_passed'] for r in by_arm[arm]):
            status = 'NO_GO_EVIDENCE_LOSS'
        elif not base['cost_complete'] or not target['cost_complete']:
            status = 'UNKNOWN_COST'
        elif len(tasks) >= min_tasks and repeats >= min_repeats and len(ratios) >= .95 * draws:
            max_ratio = 1 - gates.get('minimum_cost_improvement', .1)
            pass_margin = gates.get('pass_rate_noninferiority_margin', .02)
            max_latency = 1 + gates.get('maximum_p95_increase', .1)
            if ratio_ci[1] <= max_ratio and pass_ci[0] >= -pass_margin and latency_ratio is not None and latency_ratio <= max_latency:
                status = 'GO'
            elif ratio_ci[0] is not None and (ratio_ci[0] > max_ratio or pass_ci[1] < -pass_margin) or latency_ratio is not None and latency_ratio > max_latency:
                status = 'NO_GO'
            else:
                status = 'INCONCLUSIVE'
        comparisons[arm] = {'against': baseline, 'status': status, 'cost_ratio': ratio,
                            'cost_ratio_95ci': ratio_ci, 'pass_rate_delta_95ci': pass_ci,
                            'p95_ratio': latency_ratio}
    # Always isolate Jev's incremental value over local rules when available.
    if baseline != 'local' and 'local' in arms and 'jev' in arms:
        local_manifest = dict(manifest, baseline='local')
        local_report = report(local_manifest, rows, draws)
        comparisons['jev_vs_local'] = local_report['comparisons']['jev']
    return {'status': 'COMPLETE', 'experiment_id': manifest['experiment_id'],
            'unique_tasks': len(tasks), 'repeats': repeats, 'summaries': summaries,
            'comparisons': comparisons,
            'limitations': 'Gate applies only to these tasks. Costs supplied by CLI are estimates unless reconciled to billing; P95 ratio has no confidence interval. Require separate evidence-retention checks.'}

def markdown(obj):
    if obj['status'] != 'COMPLETE':
        return '# Agent evaluation\n\n' + json.dumps(obj, ensure_ascii=False, indent=2) + '\n'
    lines = ['# Paired agent evaluation', '', 'Actual task records; log proxy metrics are excluded.', '',
             '| Arm | Pass rate | First pass | Observed cost USD | Cost / success | P95 seconds |',
             '|---|---:|---:|---:|---:|---:|']
    for arm, r in obj['summaries'].items():
        cost = f"{r['cost_per_success_usd']:.6f}" if r['cost_per_success_usd'] is not None else 'undefined'
        if not r['cost_complete']:
            cost = 'unknown (observed lower bound ' + cost + ')'
        lines.append(f"| {arm} | {r['pass_rate']:.1%} | {r['first_pass_rate']:.1%} | {r['observed_total_cost_usd']:.6f} | {cost} | {r['p95_wall_seconds']:.3f} |")
    lines += ['', '## Decisions', '']
    for arm, c in obj['comparisons'].items():
        lines.append(f"- {arm}: **{c['status']}**; cost ratio 95% CI {c['cost_ratio_95ci']}; pass-rate delta 95% CI {c['pass_rate_delta_95ci']}; P95 ratio {c['p95_ratio']}.")
    lines += ['', obj['limitations'], '']
    return '\n'.join(lines)
