// Maintainer experiment (needs TYPESAFE_API_KEY; sends ONLY synthetic text, about 40 small requests, a fraction of a cent).
// Question: when the log hides quiet cues (lines with no error wording: a changed setting, mode, version, fallback),
// how many survive Jev pruning, by goal text and keep threshold, and how much does the output shrink?
//   node scripts/quiet-cues-experiment.ts            # goals at the default threshold (0.8), 3 shuffled logs each
//   node scripts/quiet-cues-experiment.ts --thresholds   # the goal x threshold table
// Held-out on purpose: none of the 12 cues is named in any goal text. One log shape, 3 seeds, so read it as a
// direction, not a measurement of your logs. Results are recorded in docs/REFERENCE.md.
import { prune } from '../core/prune.ts'
import { httpTransport } from '../cli/io.ts'

const CUES = [
  'locale fell back to C (requested zh_TW.UTF-8)',
  'TZ=UTC in this container; job schedule assumes Asia/Taipei',
  'using deprecated endpoint /v1/orders (replaced by /v3/orders)',
  'DRY_RUN=1 set; no changes will be applied',
  'artifact cache hit: build-7731 (created 2024-03-02)',
  'HTTP_PROXY=http://10.0.0.8:3128 applied to all requests',
  '/data is mounted read-only',
  'query returned 0 rows; continuing',
  'API_BASE overridden by .env.local: https://staging.internal',
  'plugin loader: 3 plugins skipped (license check off)',
  'git HEAD is detached at 3fa91c2 (branch main not checked out)',
  'node v16.20.0 in use; package engines field requires >=20',
]
const GOALS: Record<string, string> = {
  'G0 old default': 'Diagnose the current test or build failure',
  'G1 new default': 'Find the root cause of why this command did not give the intended result. Keep every line that could explain it, including quiet lines that state a setting, mode, version, fallback or environment that differs from what was intended, even if the line contains no error wording.',
  'G2 wide user goal': 'Find why a run did not produce the expected result. Keep any line that states an environment, version, target, configuration, feature flag, skipped step or silent fallback, even a plain INFO line with no error wording, as well as any crash, kill, connection or data-loss message in any language.',
}
// Seeded PRNG so every goal sees the same 3 logs.
function rng(seed: number) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296 }
function makeLog(seed: number): string {
  const r = rng(seed)
  const kinds = ['processed batch', 'flushed buffer', 'synced shard', 'compacted segment', 'rotated key id', 'emitted metric']
  const lines: string[] = []
  const slots = new Set<number>()
  CUES.forEach((_, i) => slots.add(24 + i * 48 + Math.floor(r() * 20)))
  let cue = 0
  for (let i = 0; i < 620; i++) {
    if (slots.has(i)) { lines.push(`[${100000 + i}] INFO ${CUES[cue++]}\n`); continue }
    lines.push(`[${100000 + i}] INFO worker-${Math.floor(r() * 9)} ${kinds[Math.floor(r() * kinds.length)]} ${Math.floor(r() * 9000)} in ${Math.floor(r() * 90)}ms\n`)
  }
  return lines.join('')
}
const transport = httpTransport(process.env.TYPESAFE_API_KEY)
if (process.argv.includes('--thresholds')) {
  const table: string[] = ['| goal | threshold | mean cues kept /12 | mean reduction |', '|---|---|---|---|']
  for (const gname of ['G0 old default', 'G1 new default']) {
    for (const threshold of [0.8, 0.5, 0.3, 0.1]) {
      let kept = 0
      let red = 0
      for (const seed of [11, 22, 33]) {
        const text = makeLog(seed)
        const { output } = await prune(text, { backend: 'jev', goal: GOALS[gname]!, threshold, transport, now: () => performance.now() })
        kept += CUES.filter((c) => output.includes(c)).length
        red += 1 - output.length / text.length
      }
      table.push(`| ${gname} | ${threshold} | ${(kept / 3).toFixed(1)} | ${((red / 3) * 100).toFixed(0)}% |`)
    }
  }
  console.log(table.join('\n'))
  process.exit(0)
}
const rows: string[] = ['| goal | run | cues kept /12 | chars in -> out | reduction | reason |', '|---|---|---|---|---|---|']
const totals: Record<string, { kept: number; red: number; n: number }> = {}
for (const [name, goal] of Object.entries(GOALS)) {
  for (const seed of [11, 22, 33]) {
    const text = makeLog(seed)
    const { output, meta } = await prune(text, { backend: 'jev', goal, threshold: 0.8, transport, now: () => performance.now() })
    const kept = CUES.filter((c) => output.includes(c)).length
    const red = 1 - output.length / text.length
    rows.push(`| ${name} | ${seed} | ${kept} | ${text.length} -> ${output.length} | ${(red * 100).toFixed(0)}% | ${meta.reason}${meta.jev_asked === false ? ' (Jev not asked)' : ''} |`)
    const t = (totals[name] ??= { kept: 0, red: 0, n: 0 }); t.kept += kept; t.red += red; t.n += 1
  }
}
// local rules only (no Jev) for reference
for (const seed of [11, 22, 33]) {
  const text = makeLog(seed)
  const { output } = await prune(text, { backend: 'rules', goal: '', threshold: 0.8 })
  const kept = CUES.filter((c) => output.includes(c)).length
  rows.push(`| rules only | ${seed} | ${kept} | ${text.length} -> ${output.length} | ${((1 - output.length / text.length) * 100).toFixed(0)}% | ok |`)
}
console.log(rows.join('\n'))
console.log('\nMEAN per goal:')
for (const [n, t] of Object.entries(totals)) console.log(`${n}: cues kept ${(t.kept / t.n).toFixed(1)}/12, reduction ${((t.red / t.n) * 100).toFixed(0)}%`)
