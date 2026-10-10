import assert from 'node:assert/strict'
import { test } from 'node:test'
import { markdown, report } from '../metrics.ts'

function fixture() {
  const manifest: Record<string, any> = { experiment_id: 'x', task_ids: ['a', 'b'], arms: ['baseline', 'local', 'jev'], baseline: 'baseline', repeats: 1 }
  const rows: Array<Record<string, any>> = []
  for (const task of manifest.task_ids) {
    for (const arm of manifest.arms) {
      rows.push({
        record_type: 'agent_task', experiment_id: 'x', task_id: task, repeat: 0, arm, success: true, first_pass: true,
        cost_complete: true, evidence_guard_passed: true, agent_cost_usd: arm === 'baseline' ? 1 : 0.7, jev_cost_usd: arm === 'jev' ? 0.01 : 0,
        wall_seconds: 10, retries: 0, seed_revision: 's', verifier_revision: 'v', environment_id: 'e', runtime_version: 'r', model_id: 'm',
      })
    }
  }
  return { manifest, rows }
}

test('insufficient evidence, and an incremental comparison against local rules', () => {
  const { manifest, rows } = fixture()
  const obj = report(manifest, rows, 50)
  assert.equal(obj.comparisons.jev.status, 'INSUFFICIENT_EVIDENCE')
  assert.ok(obj.comparisons.jev_vs_local)
  assert.ok(obj.comparisons.jev_vs_local.cost_ratio > 1)
})

test('a missing run is reported, not discarded', () => {
  const { manifest, rows } = fixture()
  assert.equal(report(manifest, rows.slice(0, -1)).status, 'INCOMPLETE')
})

test('unknown cost is not free', () => {
  const { manifest, rows } = fixture()
  rows.at(-1)!.cost_complete = false
  assert.equal(report(manifest, rows, 30).comparisons.jev.status, 'UNKNOWN_COST')
})

test('failed runs still count toward cost', () => {
  const { manifest, rows } = fixture()
  Object.assign(rows.at(-1)!, { success: false, first_pass: false })
  assert.ok(Math.abs(report(manifest, rows, 30).summaries.jev.cost_per_success_usd - 1.42) < 1e-9)
})

test('duplicates, model confounding, bad numbers and verifier drift are rejected', () => {
  let { manifest, rows } = fixture()
  assert.throws(() => report(manifest, [...rows, rows[0]]), /unexpected_or_duplicate_run/)
  ;({ manifest, rows } = fixture())
  rows.at(-1)!.model_id = 'different'
  assert.throws(() => report(manifest, rows), /unpaired_model_id/)
  ;({ manifest, rows } = fixture())
  rows.at(-1)!.wall_seconds = Infinity
  assert.throws(() => report(manifest, rows), /invalid_wall_seconds/)
  ;({ manifest, rows } = fixture())
  rows.at(-1)!.verifier_revision = 'changed'
  assert.throws(() => report(manifest, rows), /unpaired_verifier_revision/)
})

test('a loss of evidence vetoes the arm', () => {
  const { manifest, rows } = fixture()
  rows.at(-1)!.evidence_guard_passed = false
  assert.equal(report(manifest, rows, 30).comparisons.jev.status, 'NO_GO_EVIDENCE_LOSS')
})

test('zero successes leave cost per success undefined, never free', () => {
  const { manifest, rows } = fixture()
  for (const row of rows) Object.assign(row, { success: false, first_pass: false })
  assert.equal(report(manifest, rows, 30).summaries.jev.cost_per_success_usd, null)
})

test('going past the baseline can still fail the incremental gate against local rules', () => {
  const { manifest, rows } = fixture()
  manifest.gates = { minimum_unique_tasks: 2, minimum_repeats: 1 }
  const obj = report(manifest, rows, 100)
  assert.equal(obj.comparisons.jev.status, 'GO')
  assert.equal(obj.comparisons.jev_vs_local.status, 'NO_GO')
})

test('markdown states that proxy metrics are excluded and never claims savings on an incomplete report', () => {
  const { manifest, rows } = fixture()
  assert.match(markdown(report(manifest, rows, 30)), /log proxy metrics are excluded/)
  assert.match(markdown(report(manifest, rows.slice(0, -1))), /INCOMPLETE/)
})
