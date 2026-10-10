// Paired task-level report. Missing or unknown costs never become free runs. Pure: no I/O.
// Port of the former Python jevkit/metrics.py. The bootstrap uses a seeded mulberry32 generator,
// so the confidence intervals are deterministic but NOT numerically comparable with reports made
// by the Python version (v0.4.x and earlier).

type Row = Record<string, any>
type Manifest = Record<string, any>

export function percentile(values: number[], p: number): number | null {
  const ordered = [...values].sort((a, b) => a - b)
  return ordered.length ? ordered[Math.max(0, Math.ceil(p * ordered.length) - 1)] : null
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
const num = (v: unknown) => (v ? 1 : 0)

export function costPerSuccess(rows: Row[]): number | null {
  const passes = rows.reduce((sum, r) => sum + num(r.success), 0)
  return passes ? rows.reduce((sum, r) => sum + r.agent_cost_usd + r.jev_cost_usd, 0) / passes : null
}

export function summarize(rows: Row[]) {
  return {
    attempted_tasks: rows.length,
    passed_tasks: rows.reduce((s, r) => s + num(r.success), 0),
    pass_rate: mean(rows.map((r) => num(r.success))),
    first_pass_rate: mean(rows.map((r) => num(r.first_pass))),
    observed_total_cost_usd: rows.reduce((s, r) => s + r.agent_cost_usd + r.jev_cost_usd, 0),
    cost_per_success_usd: costPerSuccess(rows),
    p50_wall_seconds: percentile(rows.map((r) => r.wall_seconds), 0.5),
    p95_wall_seconds: percentile(rows.map((r) => r.wall_seconds), 0.95),
    mean_retries: mean(rows.map((r) => r.retries)),
    cost_complete: rows.every((r) => r.cost_complete),
  }
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number'
const key = (t: unknown, i: unknown, a: unknown) => JSON.stringify([t, i, a])

export function report(manifest: Manifest, rows: Row[], draws = 2000): Record<string, any> {
  const tasks: string[] = manifest.task_ids
  const arms: string[] = manifest.arms
  const repeats: number = manifest.repeats
  const baseline: string = manifest.baseline
  if (!Array.isArray(tasks) || !Array.isArray(arms) || !tasks.length || new Set(tasks).size !== tasks.length ||
      new Set(arms).size !== arms.length || !arms.includes(baseline) || !Number.isInteger(repeats) || repeats < 1) {
    throw new Error('invalid_manifest')
  }
  if (typeof manifest.experiment_id !== 'string' || !manifest.experiment_id) throw new Error('invalid_manifest')
  const gates = manifest.gates ?? {}
  for (const g of ['minimum_unique_tasks', 'minimum_repeats', 'minimum_cost_improvement', 'pass_rate_noninferiority_margin', 'maximum_p95_increase']) {
    if (g in gates && (typeof gates[g] !== 'number' || !Number.isFinite(gates[g]) || gates[g] < 0)) throw new Error('invalid_gates')
  }
  const expected = new Set<string>()
  for (const t of tasks) for (let i = 0; i < repeats; i++) for (const a of arms) expected.add(key(t, i, a))
  const keyed = new Map<string, Row>()
  for (const row of rows) {
    if (row.record_type !== 'agent_task' || row.experiment_id !== manifest.experiment_id) throw new Error('wrong_record_type_or_experiment')
    const k = key(row.task_id, row.repeat, row.arm)
    if (!expected.has(k) || keyed.has(k)) throw new Error('unexpected_or_duplicate_run')
    for (const name of ['success', 'first_pass', 'cost_complete', 'evidence_guard_passed']) {
      if (typeof row[name] !== 'boolean') throw new Error('invalid_' + name)
    }
    if (row.first_pass && !row.success) throw new Error('inconsistent_first_pass')
    for (const name of ['agent_cost_usd', 'jev_cost_usd', 'wall_seconds', 'retries']) {
      const value = row[name]
      if (!isNum(value) || !Number.isFinite(value) || value < 0) throw new Error('invalid_' + name)
    }
    if (!Number.isInteger(row.retries) || !Number.isInteger(row.repeat)) throw new Error('invalid_integer')
    for (const name of ['seed_revision', 'verifier_revision', 'environment_id', 'runtime_version', 'model_id']) {
      if (typeof row[name] !== 'string' || !row[name]) throw new Error('missing_' + name)
    }
    keyed.set(k, row)
  }
  const missing = [...expected].filter((k) => !keyed.has(k)).map((k) => JSON.parse(k)).sort((x, y) =>
    x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] - y[1] || (x[2] < y[2] ? -1 : x[2] > y[2] ? 1 : 0))
  if (missing.length) {
    return { status: 'INCOMPLETE', missing_runs: missing, reason: 'Include failures, timeouts and aborted runs; do not discard them.' }
  }
  const at = (t: string, i: number, a: string) => keyed.get(key(t, i, a)) as Row
  for (const task of tasks) {
    const group = arms.flatMap((arm) => Array.from({ length: repeats }, (_, i) => at(task, i, arm)))
    for (const name of ['seed_revision', 'verifier_revision', 'environment_id', 'runtime_version']) {
      if (new Set(group.map((r) => r[name])).size !== 1) throw new Error('unpaired_' + name)
    }
    if (!manifest.allow_model_variation && new Set(group.map((r) => r.model_id)).size !== 1) throw new Error('unpaired_model_id')
  }
  const byArm: Record<string, Row[]> = {}
  for (const arm of arms) byArm[arm] = tasks.flatMap((t) => Array.from({ length: repeats }, (_, i) => at(t, i, arm)))
  const summaries = Object.fromEntries(arms.map((arm) => [arm, summarize(byArm[arm])]))
  const comparisons: Record<string, any> = {}
  const rng = mulberry32(20261009)
  const minTasks = gates.minimum_unique_tasks ?? 100
  const minRepeats = gates.minimum_repeats ?? 3
  const base = summaries[baseline]
  for (const arm of arms) {
    if (arm === baseline) continue
    const target = summaries[arm]
    const passDeltas: number[] = []
    const ratios: number[] = []
    for (let d = 0; d < draws; d++) {
      const sampled = tasks.map(() => tasks[Math.floor(rng() * tasks.length)])
      const left = sampled.flatMap((t) => Array.from({ length: repeats }, (_, i) => at(t, i, baseline)))
      const right = sampled.flatMap((t) => Array.from({ length: repeats }, (_, i) => at(t, i, arm)))
      passDeltas.push(mean(right.map((r) => num(r.success))) - mean(left.map((r) => num(r.success))))
      const lc = costPerSuccess(left)
      const rc = costPerSuccess(right)
      if (lc !== null && lc > 0 && rc !== null) ratios.push(rc / lc)
    }
    const ci = (values: number[]): [number | null, number | null] => (values.length ? [percentile(values, 0.025), percentile(values, 0.975)] : [null, null])
    const ratioCi = ci(ratios)
    const passCi = ci(passDeltas)
    const ratio = base.cost_per_success_usd && target.cost_per_success_usd !== null ? target.cost_per_success_usd / base.cost_per_success_usd : null
    const latencyRatio = base.p95_wall_seconds ? (target.p95_wall_seconds as number) / base.p95_wall_seconds : null
    let status = 'INSUFFICIENT_EVIDENCE'
    if (!byArm[arm].every((r) => r.evidence_guard_passed)) status = 'NO_GO_EVIDENCE_LOSS'
    else if (!base.cost_complete || !target.cost_complete) status = 'UNKNOWN_COST'
    else if (tasks.length >= minTasks && repeats >= minRepeats && ratios.length >= 0.95 * draws) {
      const maxRatio = 1 - (gates.minimum_cost_improvement ?? 0.1)
      const passMargin = gates.pass_rate_noninferiority_margin ?? 0.02
      const maxLatency = 1 + (gates.maximum_p95_increase ?? 0.1)
      const [rLow, rHigh] = ratioCi as [number, number]
      const [pLow, pHigh] = passCi as [number, number]
      if (rHigh <= maxRatio && pLow >= -passMargin && latencyRatio !== null && latencyRatio <= maxLatency) status = 'GO'
      else if ((rLow !== null && (rLow > maxRatio || pHigh < -passMargin)) || (latencyRatio !== null && latencyRatio > maxLatency)) status = 'NO_GO'
      else status = 'INCONCLUSIVE'
    }
    comparisons[arm] = { against: baseline, status, cost_ratio: ratio, cost_ratio_95ci: ratioCi, pass_rate_delta_95ci: passCi, p95_ratio: latencyRatio }
  }
  // Always isolate Jev's incremental value over local rules when available.
  if (baseline !== 'local' && arms.includes('local') && arms.includes('jev')) {
    comparisons.jev_vs_local = report({ ...manifest, baseline: 'local' }, rows, draws).comparisons.jev
  }
  return {
    status: 'COMPLETE', experiment_id: manifest.experiment_id, unique_tasks: tasks.length, repeats, summaries, comparisons,
    limitations: 'Gate applies only to these tasks. Costs supplied by CLI are estimates unless reconciled to billing; P95 ratio has no confidence interval. Require separate evidence-retention checks.',
  }
}

const pct = (x: number) => (x * 100).toFixed(1) + '%'

export function markdown(obj: Record<string, any>): string {
  if (obj.status !== 'COMPLETE') return '# Agent evaluation\n\n' + JSON.stringify(obj, null, 2) + '\n'
  const lines = ['# Paired agent evaluation', '', 'Actual task records; log proxy metrics are excluded.', '',
    '| Arm | Pass rate | First pass | Observed cost USD | Cost / success | P95 seconds |', '|---|---:|---:|---:|---:|---:|']
  for (const [arm, r] of Object.entries<any>(obj.summaries)) {
    let cost = r.cost_per_success_usd !== null ? r.cost_per_success_usd.toFixed(6) : 'undefined'
    if (!r.cost_complete) cost = 'unknown (observed lower bound ' + cost + ')'
    lines.push(`| ${arm} | ${pct(r.pass_rate)} | ${pct(r.first_pass_rate)} | ${r.observed_total_cost_usd.toFixed(6)} | ${cost} | ${r.p95_wall_seconds.toFixed(3)} |`)
  }
  lines.push('', '## Decisions', '')
  for (const [arm, c] of Object.entries<any>(obj.comparisons)) {
    lines.push(`- ${arm}: **${c.status}**; cost ratio 95% CI ${JSON.stringify(c.cost_ratio_95ci)}; pass-rate delta 95% CI ${JSON.stringify(c.pass_rate_delta_95ci)}; P95 ratio ${c.p95_ratio}.`)
  }
  lines.push('', obj.limitations, '')
  return lines.join('\n')
}
