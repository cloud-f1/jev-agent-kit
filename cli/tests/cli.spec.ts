import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import golden from '../../tests/fixtures/golden.ts'
import { build } from '../../scripts/gen-golden.ts'
import { loadProjectConfig, logBench, main, optionsFromEnv } from '../jev.ts'

const tmp = () => mkdtempSync(join(tmpdir(), 'jev-cli-'))
function project(file?: unknown) {
  const dir = tmp()
  if (file !== undefined) {
    mkdirSync(join(dir, '.claude'))
    writeFileSync(join(dir, '.claude', 'jev-agent-kit.json'), JSON.stringify(file))
  }
  return dir
}

test('precedence: defaults < plugin settings < project file', () => {
  const env = { CLAUDE_PLUGIN_OPTION_MODE: 'assist', CLAUDE_PLUGIN_OPTION_RETENTION_DAYS: '14' }
  const cfg = loadProjectConfig(project({ mode: 'observe', enabled: true }), env)
  assert.deepEqual([cfg.mode, cfg.retentionDays, cfg.enabled], ['observe', 14, true])
})

test('a bad plugin option is ignored; a bad project file is rejected', () => {
  assert.equal(loadProjectConfig(project(), { CLAUDE_PLUGIN_OPTION_MODE: 'bogus' }).mode, 'observe')
  assert.throws(() => loadProjectConfig(project({ endpoint: 'https://evil.example' }), {}), /unsupported_config_fields/)
})

test('enable-everywhere is user level and a project can refuse it', () => {
  const env = { CLAUDE_PLUGIN_OPTION_ENABLE_ALL_PROJECTS: 'true' }
  assert.equal(loadProjectConfig(project(), env).enabled, true)
  assert.equal(loadProjectConfig(project({ enabled: false }), env).enabled, false)
  assert.equal(loadProjectConfig(project(), {}).enabled, false)
})

test('the CLI settings layer agrees with every golden merge case', () => {
  const names: Record<string, string> = { mode: 'MODE', backend: 'BACKEND', minimum_chars: 'MINIMUM_CHARS', keep_threshold: 'KEEP_THRESHOLD', retention_days: 'RETENTION_DAYS', enable_all_projects: 'ENABLE_ALL_PROJECTS' }
  for (const c of golden.merges) {
    const env = Object.fromEntries(Object.entries(c.options).map(([k, v]) => ['CLAUDE_PLUGIN_OPTION_' + names[k], String(v)]))
    const dir = project(c.project ?? undefined)
    if ('error' in (c.expected as object)) assert.throws(() => loadProjectConfig(dir, env), /./, JSON.stringify(c.options))
    else assert.deepEqual(loadProjectConfig(dir, env), c.expected, JSON.stringify(c.options))
  }
  assert.deepEqual(optionsFromEnv({ CLAUDE_PLUGIN_OPTION_ENABLE_ALL_PROJECTS: 'false' }), { enable_all_projects: false })
})

test('the checked-in golden fixture is exactly what the TypeScript core produces', async () => {
  assert.equal(JSON.stringify(golden), JSON.stringify(await build()))
})

test('mock log benchmark keeps every error line and the planted context in the Jev arm', async () => {
  const dir = tmp()
  const logs: string[] = []
  const original = console.log
  console.log = (line: string) => logs.push(line)
  try {
    assert.equal(await logBench(dir, false), 0)
  } finally {
    console.log = original
  }
  const rows = JSON.parse(readFileSync(join(dir, 'log-proxy.json'), 'utf8'))
  assert.equal(rows.length, 15)
  for (const r of rows) assert.equal(r.error_retention, true, `${r.fixture}/${r.arm}`)
  for (const r of rows.filter((x: any) => x.arm === 'mock_jev')) {
    assert.equal(r.evidence_retention, 1)
    assert.equal(r.jev_cost_usd_estimate, null, 'mock usage is never a cost')
    assert.ok(r.character_reduction > 0.5)
  }
  for (const r of rows.filter((x: any) => x.arm === 'local')) assert.equal(r.evidence_retention, 0.5)
  assert.match(readFileSync(join(dir, 'log-proxy.md'), 'utf8'), /No agent task success or downstream dollar savings are measured/)
})

test('exit codes: no verdict is 3 for a missing key, bad input is 2 and never echoes input', async () => {
  const original = console.log
  const out: string[] = []
  console.log = (line: string) => out.push(line)
  try {
    assert.equal(await main(['smoke'], {}), 3)
    assert.match(out.join('\n'), /"reason": "missing_key"/)
    out.length = 0
    assert.equal(await main(['readback', '../../etc/passwd'], {}), 2)
    assert.match(out.join('\n'), /invalid_input_or_local_io/)
    assert.doesNotMatch(out.join('\n'), /passwd/)
    out.length = 0
    assert.equal(await main(['report', '--manifest', '/nonexistent', '--records', '/nonexistent'], {}), 2)
  } finally {
    console.log = original
  }
})

test('--env-file works in the space form, before or after the command', async () => {
  const dir = tmp()
  const file = join(dir, 'e.env')
  writeFileSync(file, 'TYPESAFE_API_KEY=fake-key-123456789\n')
  const original = console.log
  for (const argv of [['--env-file', file, 'doctor'], ['doctor', '--env-file', file], [`--env-file=${file}`, 'doctor']]) {
    const env: Record<string, string | undefined> = {}
    const out: string[] = []
    console.log = (line: string) => out.push(line)
    try {
      assert.equal(await main(argv, env), 0, argv.join(' '))
    } finally {
      console.log = original
    }
    assert.match(out.join('\n'), /"jev_key_present": true/)
    assert.doesNotMatch(out.join('\n'), /fake-key-123456789/)
  }
})
