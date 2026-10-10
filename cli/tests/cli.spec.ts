import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import golden from '../../tests/fixtures/golden.ts'
import { build } from '../../scripts/gen-golden.ts'
import { spawnSync } from 'node:child_process'
import { JevError } from '../../core/contracts.ts'
import { HELP, loadProjectConfig, loadProjectEffective, logBench, main, optionsFromEnv, verifyKey } from '../jev.ts'

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

async function run(argv: string[], env: Record<string, string | undefined> = {}) {
  const out: string[] = []
  const original = console.log
  const write = process.stdout.write.bind(process.stdout)
  console.log = (line: string) => out.push(String(line))
  process.stdout.write = ((chunk: string) => (out.push(String(chunk)), true)) as typeof process.stdout.write
  try {
    return { code: await main(argv, env), text: out.join('\n') }
  } finally {
    console.log = original
    process.stdout.write = write
  }
}

test('--help, -h and help exit 0 with one line per command and the network commands marked', async () => {
  for (const argv of [['--help'], ['-h'], ['help'], ['doctor', '--help']]) {
    const { code, text } = await run(argv)
    assert.equal(code, 0, argv.join(' '))
    assert.equal(text, HELP)
  }
  for (const command of ['doctor', 'smoke', 'bench-logs', 'check-config', 'status', 'readback', 'report']) assert.match(HELP, new RegExp('^  ' + command, 'm'))
  assert.match(HELP, /smoke\s+\[network\]/)
  assert.match(HELP, /--live \[network\]/)
  assert.match(HELP, /22\.6 to 22\.17/)
  assert.doesNotMatch(HELP, /fake-key/)
})

test('--version prints the version; no command and unknown commands still exit 2', async () => {
  assert.match((await run(['--version'])).text, /^\d+\.\d+\.\d+$/)
  assert.equal((await run([])).code, 2)
  assert.equal((await run(['nonsense'])).code, 2)
})

test('check-config reports the source of every value', async () => {
  const dir = project({ backend: 'jev', enabled: true })
  const env = { CLAUDE_PLUGIN_OPTION_MODE: 'assist', CLAUDE_PLUGIN_OPTION_RETENTION_DAYS: '14' }
  const { sources } = loadProjectEffective(dir, env)
  assert.equal(sources.backend, 'project file')
  assert.equal(sources.enabled, 'project file')
  assert.equal(sources.mode, 'plugin settings')
  assert.equal(sources.retentionDays, 'plugin settings')
  assert.equal(sources.minimumChars, 'default')
  const out = JSON.parse((await run(['check-config', '--project', dir], env)).text)
  assert.equal(out.backend, 'jev')
  assert.equal(out.sources.backend, 'project file')
  assert.equal(out.sources.mode, 'plugin settings')
})

test('doctor stays offline without --verify and has no key_check', async () => {
  const { code, text } = await run(['doctor'], { TYPESAFE_API_KEY: 'fake-key-123456789' })
  assert.equal(code, 0)
  assert.doesNotMatch(text, /key_check/)
  assert.doesNotMatch(text, /fake-key-123456789/)
})

test('verifyKey maps outcomes to fixed words and never echoes the key', async () => {
  const good = () => async () => ({ model: 'jev-1.13.0', answers: { failed: { type: 'noul', noul: 0.96 } }, usage: { input_tokens: 1, output_tokens: 1 } })
  const fail = (reason: string) => () => async () => { throw new JevError(reason) }
  assert.equal(await verifyKey(undefined, good), 'missing')
  assert.equal(await verifyKey('REPLACE_ME', good), 'missing')
  assert.equal(await verifyKey('fake-key-123456789', good), 'valid')
  assert.equal(await verifyKey('fake-key-123456789', fail('http_401')), 'invalid (401)')
  assert.equal(await verifyKey('fake-key-123456789', fail('http_403')), 'invalid (403)')
  assert.equal(await verifyKey('fake-key-123456789', fail('http_429')), 'error (http_429)')
  assert.equal(await verifyKey('fake-key-123456789', () => async () => { throw new Error('secret fake-key-123456789 in text') }), 'error (invalid_input_or_local_io)')
})

test('doctor --verify with no key reports missing and exits 3 without any network call', async () => {
  const { code, text } = await run(['doctor', '--verify'], {})
  assert.equal(code, 3)
  assert.match(text, /"key_check": "missing"/)
})

test('scripts/jev.sh runs the CLI and passes its arguments through', { skip: process.platform === 'win32' }, () => {
  const help = spawnSync('sh', ['scripts/jev.sh', '--help'], { encoding: 'utf8' })
  assert.equal(help.status, 0, help.stderr)
  assert.equal(help.stdout, HELP)
  const version = spawnSync('sh', ['scripts/jev.sh', '--version'], { encoding: 'utf8' })
  assert.match(version.stdout, /^\d+\.\d+\.\d+\n$/)
})
