import { expect, mock, test } from 'claude-code/testing'
import { MODEL } from '../core/contracts.ts'
import { digestString } from '../core/hash.ts'

const CWD = '/work/project'
const STATE = '/state'

function longLog(): string {
  const lines = Array.from({ length: 320 }, (_, i) => `progress item ${i}\n`)
  lines[141] = 'ERROR build: expected contract, got invalid\n'
  return lines.join('')
}

interface Setup {
  config?: unknown
  env?: Record<string, string>
  tool?: unknown
  files?: Record<string, string>
  failWrites?: boolean
  realCwd?: string
  gitExit?: number
  settingsEnv?: Record<string, string>
  configDeny?: boolean
  paneUnplaced?: boolean
  paneThrows?: boolean
  projectSettingsEnv?: Record<string, string> // a cloned repo's .claude/settings.json: must never be used
  throwOnWrite?: boolean
  http?: (url: string, init: any) => any
}

// Stubs every Claude Code answer the Mod needs. `written` captures private writes by path.
function stubs(on: any, setup: Setup = {}) {
  const env: Record<string, string> = { HOME: '/home/u', JEV_STATE_DIR: STATE, ...(setup.env ?? {}) }
  const files: Record<string, string> = { ...(setup.files ?? {}) }
  if (setup.config !== undefined) files[CWD + '/.claude/jev-agent-kit.json'] = JSON.stringify(setup.config)
  const written: Record<string, string> = {}
  const commands: string[][] = []
  const scripts: string[] = []
  const fsWrites: string[] = []
  const registered: string[] = []
  const toasts: string[] = []
  const logs: string[] = []
  const status: string[] = []
  const configSets: Array<{ key: string; value: unknown }> = []
  const panes: string[] = []
  const requests: Array<{ url: string; init: any }> = []
  mock.clock(on)
  on('env.get', (_: any, e: any) => ({ value: env[e.name] }))
  on('session.cwd', () => ({ value: CWD }))
  on('session.id', () => ({ value: 'session-golden' }))
  on('fs.stat', (_: any, e: any) => ({ value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: false, realPath: e.path === CWD ? (setup.realCwd ?? CWD) : e.path } }))
  on('fs.write', (_: any, e: any) => { written[e.path] = e.text; fsWrites.push(e.path); return { value: undefined } })
  on('fs.exists', (_: any, e: any) => ({ value: e.path in files }))
  on('fs.read', (_: any, e: any) => {
    if (!(e.path in files) && !(e.path in written)) throw new Error('ENOENT')
    return { value: files[e.path] ?? written[e.path] }
  })
  on('fs.list', (_: any, e: any) => ({
    value: Object.keys(written).filter((p) => p.startsWith(e.path + '/')).map((p) => ({ name: p.slice(e.path.length + 1), kind: 'file', size: 1, isLink: false })),
  }))
  on('process.run', (_: any, e: any) => {
    commands.push([...e.argv])
    if (e.argv[0] === 'find') return { value: { exitCode: 0, stdout: '', stderr: '' } }
    if (e.argv[0] === 'git') return { value: { exitCode: setup.gitExit ?? 0, stdout: setup.gitExit ? '' : 'abc123', stderr: '' } }
    if (e.argv[0] === 'sh') {
      if (setup.failWrites) return { value: { exitCode: 1, stdout: '', stderr: 'denied' } }
      scripts.push(e.argv[2])
      written[e.argv[e.argv.length - 1]] = e.init?.stdin ?? ''
      return { value: { exitCode: 0, stdout: '', stderr: '' } }
    }
    return { value: { exitCode: 127, stdout: '', stderr: '' } }
  })
  on('http.fetch', (_: any, e: any) => {
    requests.push({ url: e.url, init: e.init })
    return { value: setup.http ? setup.http(e.url, e.init) : { ok: false, status: 500, headers: {}, text: '' } }
  })
  on('ui.toast', (_: any, e: any) => { toasts.push(e.text); return { value: undefined } })
  on('ui.log', (_: any, e: any) => { logs.push(e.text); return { value: undefined } })
  on('settings.read', (_: any, e: any) => ({ value: { env: ((e?.source === 'user' ? setup.settingsEnv : e?.source === undefined ? { ...setup.projectSettingsEnv, ...setup.settingsEnv } : setup.projectSettingsEnv) ?? {}) } }))
  on('config.set', (_: any, e: any) => { configSets.push({ key: e.key, value: e.value }); return setup.configDeny ? { deny: 'locked' } : { value: e.value } })
  on('ui.open', (_: any, e: any) => {
    if (setup.paneThrows) throw new Error('no panes here')
    panes.push('open:' + e.id)
    return { value: setup.paneUnplaced ? { isPlaced: false, reason: 'narrow' } : { isPlaced: true } }
  })
  on('ui.close', (_: any, e: any) => { panes.push('close:' + e.id); return { value: undefined } })
  on('ui.resolve', () => ({
    Box: ({ children, ...props }: any) => ({ type: 'Box', props, children }),
    Text: ({ children, ...props }: any) => ({ type: 'Text', props, children }),
  }))
  on('ui.status', (_: any, e: any) => { status.push(e.text); return { value: undefined } })
  on('command.register', (_: any, e: any) => { registered.push(e.name); return { value: undefined } })
  on('session.start', () => ({ cwd: CWD }))
  const bash = { stdout: longLog(), stderr: 'WARNING stderr evidence', interrupted: false, isImage: false }
  on('tool.call', () => (setup.tool ?? { result: bash, text: 'original' }))
  return { panes, configSets, written, status, requests, bash, files, commands, scripts, fsWrites, registered, toasts, logs }
}

// The stub host's `command.run` takes the raw input (origin etc. are defaulted at run time).
const jev = ($: any, args: string): Promise<{ text: string }> => $.command.run({ command: 'jev', args })
const call = ($: any) => $.tool.call({ tool: 'Bash', command: 'npm test' })
const artifacts = (written: Record<string, string>) => Object.keys(written).filter((p) => p.includes('/artifacts/'))
const decisions = (written: Record<string, string>) =>
  Object.entries(written).filter(([p]) => p.includes('/decisions/')).map(([, v]) => JSON.parse(v))

test('session.start registers /jev and writes no marker file', async ($, on) => {
  const s = stubs(on)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: CWD })
  expect(s.registered).toContain('jev')
  expect(Object.keys(s.written).filter((p) => p.includes('mod-active'))).toEqual([])
})

test('a project without config is left alone', async ($, on) => {
  const s = stubs(on)
  const out: any = await call($)
  expect(out.text).toBe('original')
  expect(Object.keys(s.written)).toEqual([])
})

test('disabled config does nothing', async ($, on) => {
  const s = stubs(on, { config: { enabled: false } })
  const out: any = await call($)
  expect(out.text).toBe('original')
  expect(Object.keys(s.written)).toEqual([])
})

test('observe mode stores the original and records, but never rewrites', async ($, on) => {
  const s = stubs(on, { config: { enabled: true, mode: 'observe', backend: 'rules', minimumChars: 100 } })
  const out: any = await call($)
  expect(out.text).toBe('original')
  expect(out.result.stdout).toBe(s.bash.stdout)
  const [path] = artifacts(s.written)
  expect(s.written[path!]).toBe(s.bash.stdout)
  expect(decisions(s.written).some((d) => d.reason === 'ok' && d.mode === 'observe')).toBe(true)
})

test('assist mode rewrites stdout, keeps stderr, and points to readback', async ($, on) => {
  const s = stubs(on, { config: { enabled: true, mode: 'assist', backend: 'rules', minimumChars: 100 } })
  const out: any = await call($)
  expect(out.result.stderr).toBe('WARNING stderr evidence')
  expect(out.result.stdout).toContain('ERROR build')
  expect(out.result.stdout).toContain('/jev readback ')
  expect(out.result.stdout.length).toBeLessThan(s.bash.stdout.length)
  expect(out.ref).toBeUndefined()
  const id = artifacts(s.written)[0]!.split('/').pop()!.replace('.log', '')
  expect(out.result.stdout).toContain(id)
  expect(s.status.some((t) => t.includes('1/1'))).toBe(true)
})

test('output below minimumChars is untouched', async ($, on) => {
  const s = stubs(on, { config: { enabled: true, mode: 'assist', backend: 'rules', minimumChars: 1_000_000 } })
  const out: any = await call($)
  expect(out.text).toBe('original')
  expect(artifacts(s.written)).toEqual([])
})

const ASSIST = { enabled: true, mode: 'assist', backend: 'rules', minimumChars: 100 }
const untouchable: Array<[string, unknown]> = [
  ['interrupted', { result: { stdout: longLog(), stderr: '', interrupted: true, isImage: false }, text: 'kept' }],
  ['image', { result: { stdout: longLog(), stderr: '', interrupted: false, isImage: true }, text: 'kept' }],
  ['missing stderr field', { result: { stdout: longLog(), interrupted: false, isImage: false }, text: 'kept' }],
  ['non-object result', { result: 'plain string result', text: 'kept' }],
  ['denied elsewhere', { deny: 'kept' }],
]
for (const [name, tool] of untouchable) {
  test('never rewritten: ' + name, async ($, on) => {
    stubs(on, { config: ASSIST, tool })
    const out: any = await call($)
    expect(out.text ?? out.deny).toBe('kept')
  })
}

test('failed commands (isError) are observed for loops but never rewritten', async ($, on) => {
  const s = stubs(on, { config: ASSIST, tool: { result: { stdout: longLog(), stderr: '' }, isError: true, text: 'kept' } })
  const out: any = await call($)
  expect(out.text).toBe('kept')
  expect(artifacts(s.written)).toEqual([])
  expect(decisions(s.written).some((d) => d.feature === 'loop')).toBe(true)
})

test('repeated identical failures raise repeated_count (observe only)', async ($, on) => {
  const s = stubs(on, { config: ASSIST, tool: { result: { stdout: 'x', stderr: '' }, isError: true, text: 'same failure' } })
  await call($)
  await call($)
  await call($)
  const counts = decisions(s.written).filter((d) => d.feature === 'loop').map((d) => d.repeated_count).sort()
  expect(counts).toEqual([1, 2, 3])
})

test('storage failure falls back to the original result', async ($, on) => {
  stubs(on, { config: ASSIST, failWrites: true })
  const out: any = await call($)
  expect(out.text).toBe('original')
})

test('invalid config falls back to the original result', async ($, on) => {
  stubs(on, { config: { enabled: true, endpoint: 'https://evil.example' } })
  const out: any = await call($)
  expect(out.text).toBe('original')
})

test('jev backend without a key falls back and records the reason', async ($, on) => {
  const s = stubs(on, { config: { ...ASSIST, backend: 'jev' } })
  const out: any = await call($)
  expect(s.requests.length).toBe(0)
  expect(out.result.stdout).toContain('ERROR build')
  expect(decisions(s.written).some((d) => d.reason === 'missing_key')).toBe(true)
})

test('jev backend with a key sends the redacted request to the fixed endpoint only', async ($, on) => {
  const http = (_url: string, init: any) => {
    const body = JSON.parse(init.body)
    const answers = Object.fromEntries(Object.keys(body.questions).map((id) => [id, { type: 'noul', noul: 0.01 }]))
    return { ok: true, status: 200, headers: {}, text: JSON.stringify({ model: MODEL, usage: { input_tokens: 50, output_tokens: 0 }, answers }) }
  }
  const s = stubs(on, { config: { ...ASSIST, backend: 'jev' }, env: { TYPESAFE_API_KEY: 'test-key-123' }, http })
  const out: any = await call($)
  expect(s.requests.length).toBe(1)
  expect(s.requests[0]!.url).toBe('https://api.typesafe.ai/v1/systemone')
  expect(s.requests[0]!.init.headers.Authorization).toBe('Bearer test-key-123')
  expect(out.result.stdout.length).toBeLessThan(s.bash.stdout.length)
  const record = decisions(s.written).find((d) => d.backend === 'jev')
  expect(record.api_input_tokens).toBe(50)
  expect(JSON.stringify(s.written)).not.toContain('test-key-123')
})

test('jev API errors never leave the key or body in any record', async ($, on) => {
  const http = () => ({ ok: false, status: 429, headers: {}, text: 'rate limited: Bearer test-key-123 body details' })
  const s = stubs(on, { config: { ...ASSIST, backend: 'jev' }, env: { TYPESAFE_API_KEY: 'test-key-123' }, http })
  await call($)
  const text = JSON.stringify(s.written)
  expect(text).not.toContain('test-key-123')
  expect(text).not.toContain('body details')
  expect(decisions(s.written).some((d) => d.reason === 'http_429')).toBe(true)
})

test('key can come from JEV_ENV_FILE', async ($, on) => {
  const http = () => ({ ok: false, status: 401, headers: {}, text: '' })
  const s = stubs(on, {
    config: { ...ASSIST, backend: 'jev' }, env: { JEV_ENV_FILE: '/secrets/.env.local' },
    files: { '/secrets/.env.local': 'TYPESAFE_API_KEY=file-key-9\n' }, http,
  })
  await call($)
  expect(s.requests[0]!.init.headers.Authorization).toBe('Bearer file-key-9')
})

test('/jev doctor reports state without revealing the key', async ($, on) => {
  stubs(on, { config: ASSIST, env: { TYPESAFE_API_KEY: 'test-key-123' } })
  const out = await jev($, 'doctor')
  expect(out.text).toContain('enabled=true')
  expect(out.text).toContain('present')
  expect(out.text).not.toContain('test-key-123')
})

test('/jev readback returns the stored original and rejects bad ids', async ($, on) => {
  const s = stubs(on, { config: ASSIST })
  const out: any = await call($)
  const id = out.result.stdout.match(/readback ([a-f0-9]{32})/)[1]
  const back = await jev($, 'readback ' + id)
  expect(back.text).toBe(s.bash.stdout)
  const bad = await jev($, 'readback ../../etc/passwd')
  expect(bad.text).toContain('Usage')
  const missing = await jev($, 'readback ' + 'a'.repeat(32))
  expect(missing.text).toContain('No artifact')
})

test('/jev status lists recent decision records', async ($, on) => {
  stubs(on, { config: ASSIST })
  await call($)
  const out = await jev($, 'status')
  expect(out.text).toContain('records for this project')
})

test('/jev with no or unknown subcommand prints usage', async ($, on) => {
  stubs(on)
  expect((await jev($, '')).text).toContain('Usage')
  expect((await jev($, 'frobnicate')).text).toContain('Usage')
})

test('every private write runs under umask 077 (raw logs may hold secrets)', async ($, on) => {
  const s = stubs(on, { config: ASSIST })
  await call($)
  expect(s.scripts.length).toBeGreaterThan(0)
  for (const script of s.scripts) expect(script.startsWith('umask 077;')).toBe(true)
})

test('the request to Jev contains no bearer, JSON or quoted secrets from the log', async ($, on) => {
  let sent = ''
  const http = (_u: string, init: any) => {
    sent = init.body
    return { ok: false, status: 500, headers: {}, text: '' }
  }
  const lines = Array.from({ length: 320 }, (_, i) => `progress ${i}\n`)
  lines[100] = 'curl -H "Authorization: Bearer LEAKEDBEARER99" https://x\n'
  lines[200] = '{"api_key": "LEAKEDJSON77", "password": "LEAKEDPW55"}\n'
  const tool = { result: { stdout: lines.join(''), stderr: '', interrupted: false, isImage: false }, text: 'x' }
  stubs(on, { config: { ...ASSIST, backend: 'jev' }, env: { TYPESAFE_API_KEY: 'k-12345678' }, http, tool })
  await call($)
  expect(sent.length).toBeGreaterThan(0)
  for (const secret of ['LEAKEDBEARER99', 'LEAKEDJSON77', 'LEAKEDPW55']) expect(sent).not.toContain(secret)
})

test('records never claim savings for results that were not rewritten', async ($, on) => {
  const tool = { result: { stdout: longLog(), stderr: '', interrupted: true, isImage: false }, text: 'kept' }
  const s = stubs(on, { config: ASSIST, tool })
  await call($)
  const prune = decisions(s.written).find((d) => d.reason === 'ok')
  expect(prune.delivered_chars).toBe(prune.input_chars)
})

test('a result missing interrupted/isImage is left alone and flagged', async ($, on) => {
  const tool = { result: { stdout: longLog(), stderr: '' }, text: 'kept' }
  const s = stubs(on, { config: ASSIST, tool })
  const out: any = await call($)
  expect(out.text).toBe('kept')
  expect(decisions(s.written).some((d) => d.reason === 'missing_tool_fields')).toBe(true)
})

test('artifacts are stored under the physical (symlink-resolved) project path', async ($, on) => {
  const s = stubs(on, { config: ASSIST, realCwd: '/private/work/project' })
  await call($)
  const expected = (await digestString('/private/work/project')).slice(0, 24)
  expect(artifacts(s.written)[0]).toContain('/' + expected + '/artifacts/')
})

test('JEV_STATE_DIR must be absolute: a relative value falls back to the home cache', async ($, on) => {
  const s = stubs(on, { config: ASSIST, env: { JEV_STATE_DIR: '~someone/state' } })
  await call($)
  for (const path of Object.keys(s.written)) expect(path.startsWith('/home/u/.cache/jev-agent-kit/')).toBe(true)
})

test('JEV_STATE_DIR with a leading ~/ expands against HOME', async ($, on) => {
  const s = stubs(on, { config: ASSIST, env: { JEV_STATE_DIR: '~/custom-state' } })
  await call($)
  for (const path of Object.keys(s.written)) expect(path.startsWith('/home/u/custom-state/')).toBe(true)
})

test('session.start enforces retentionDays for this project', async ($, on) => {
  const s = stubs(on, { config: { ...ASSIST, retentionDays: 3 } })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: CWD })
  const finds = s.commands.filter((c) => c[0] === 'find')
  expect(finds.length).toBe(1)
  expect(finds[0]!.includes('+3') && finds[0]!.includes('-delete')).toBe(true)
})

test('no retention cleanup for a project that has not opted in', async ($, on) => {
  const s = stubs(on)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: CWD })
  expect(s.commands.filter((c) => c[0] === 'find')).toEqual([])
})

test('git state is unknown (not a shared fingerprint) when git fails', async ($, on) => {
  const s = stubs(on, { config: ASSIST, gitExit: 128, tool: { result: { stdout: 'x', stderr: '' }, isError: true, text: 'same' } })
  await call($)
  const loop = decisions(s.written).find((d) => d.feature === 'loop')
  expect(loop.repo_state_known).toBe(false)
})

test('git state is known when git succeeds', async ($, on) => {
  const s = stubs(on, { config: ASSIST, tool: { result: { stdout: 'x', stderr: '' }, isError: true, text: 'same' } })
  await call($)
  expect(decisions(s.written).find((d) => d.feature === 'loop').repo_state_known).toBe(true)
})

const optsTest = (name: string, options: Record<string, unknown>, fn: (...a: any[]) => Promise<void>) =>
  test(name, { options } as any, fn)

optsTest('plugin setting "enable in every project" works without a project file', { enable_all_projects: true, mode: 'observe', minimum_chars: 100 }, async ($: any, on: any) => {
  const s = stubs(on)
  const out: any = await call($)
  expect(out.text).toBe('original')
  expect(decisions(s.written).some((d) => d.reason === 'ok')).toBe(true)
})

optsTest('plugin setting mode=assist rewrites; a project file can still say observe', { enable_all_projects: true, mode: 'assist', minimum_chars: 100 }, async ($: any, on: any) => {
  const assist = stubs(on)
  const out: any = await call($)
  expect(out.result.stdout).toContain('/jev readback ')
  expect(assist.written).toBeDefined()
})

optsTest('a project file overrides plugin settings, including opting out', { enable_all_projects: true, mode: 'assist', minimum_chars: 100 }, async ($: any, on: any) => {
  const s = stubs(on, { config: { enabled: false } })
  const out: any = await call($)
  expect(out.text).toBe('original')
  expect(Object.keys(s.written)).toEqual([])
})

optsTest('the API key from plugin settings is used and never recorded', { enable_all_projects: true, mode: 'assist', backend: 'jev', minimum_chars: 100, typesafe_api_key: 'settings-key-777' }, async ($: any, on: any) => {
  const http = () => ({ ok: false, status: 401, headers: {}, text: 'settings-key-777 echoed' })
  const s = stubs(on, { http })
  await call($)
  expect(s.requests[0]!.init.headers.Authorization).toBe('Bearer settings-key-777')
  expect(JSON.stringify(s.written)).not.toContain('settings-key-777')
})

optsTest('the environment key wins over the plugin-settings key', { enable_all_projects: true, backend: 'jev', minimum_chars: 100, typesafe_api_key: 'settings-key-777' }, async ($: any, on: any) => {
  const s = stubs(on, { env: { TYPESAFE_API_KEY: 'env-key-111' }, http: () => ({ ok: false, status: 500, headers: {}, text: '' }) })
  await call($)
  expect(s.requests[0]!.init.headers.Authorization).toBe('Bearer env-key-111')
})

optsTest('/jev doctor names where each value comes from and never shows the key', { enable_all_projects: true, mode: 'assist', typesafe_api_key: 'settings-key-777' }, async ($: any, on: any) => {
  stubs(on, { config: { minimumChars: 4000 } })
  const out = await jev($, 'doctor')
  expect(out.text).toContain('mode=assist (plugin settings)')
  expect(out.text).toContain('minimumChars=4000 (project file)')
  expect(out.text).toContain('plugin settings (secure storage)')
  expect(out.text).not.toContain('settings-key-777')
})

test('/jev doctor tells an un-opted-in user exactly what to do', async ($, on) => {
  stubs(on)
  const out = await jev($, 'doctor')
  expect(out.text).toContain('NOT opted in')
  expect(out.text).toContain('Enable in every project')
})

// ---- Windows branch: exercised with stubs only; it has NOT been run on Windows.
test('Windows: private writes use the file API, never sh', async ($, on) => {
  const s = stubs(on, { config: ASSIST, env: { OS: 'Windows_NT', HOME: '', USERPROFILE: 'C:\\Users\\u', JEV_STATE_DIR: 'C:\\state' } })
  const out: any = await call($)
  expect(out.result.stdout).toContain('/jev readback ')
  expect(s.scripts).toEqual([])
  expect(s.commands.some((c) => c[0] === 'sh')).toBe(false)
  expect(s.fsWrites.length).toBeGreaterThan(0)
  // The host resolves paths against this machine's cwd, so compare with includes.
  expect(s.fsWrites.every((p) => p.includes('C:\\state/'))).toBe(true)
})

test('Windows: default state directory comes from USERPROFILE', async ($, on) => {
  const s = stubs(on, { config: ASSIST, env: { OS: 'Windows_NT', HOME: '', USERPROFILE: 'C:\\Users\\u', JEV_STATE_DIR: '' } })
  await call($)
  expect(s.fsWrites.every((p) => p.includes('C:\\Users\\u/.cache/jev-agent-kit/'))).toBe(true)
})

test('Windows: retention runs PowerShell with parameters, not interpolated text', async ($, on) => {
  const s = stubs(on, { config: { ...ASSIST, retentionDays: 5 }, env: { OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\u', JEV_STATE_DIR: 'C:\\state' } })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: CWD })
  const ps = s.commands.find((c) => c[0] === 'powershell')!
  expect(ps).toBeDefined()
  expect(ps[ps.length - 1]).toBe('5')
  expect(ps[ps.length - 2]!.startsWith('C:\\state/')).toBe(true)
  expect(ps.slice(0, -2).join(' ')).not.toContain('C:\\state')
  expect(s.commands.some((c) => c[0] === 'find')).toBe(false)
})

const dirCases: Array<[string, boolean]> = [['C:/s', true], ['\\\\srv\\share', true], ['/abs', true], ['rel/dir', false], ['~u/x', false], ['D:x', false]]
for (const [dir, ok] of dirCases) {
  test('state dir ' + JSON.stringify(dir) + (ok ? ' is used' : ' falls back to the home cache'), async ($, on) => {
    const s = stubs(on, { config: ASSIST, env: { OS: 'Windows_NT', HOME: '', USERPROFILE: 'C:\\Users\\u', JEV_STATE_DIR: dir } })
    await call($)
    const first = s.fsWrites[0]
    expect(first!.includes(dir + '/')).toBe(ok)
    if (!ok) expect(first!.includes('C:\\Users\\u/.cache/jev-agent-kit/')).toBe(true)
  })
}

// ---- v0.2.1: visible failures, settings.env key, model setting
const JEV_ASSIST = { ...ASSIST, backend: 'jev' }

test('a failing Jev backend tells the user once per reason, with a fixed reason code only', async ($, on) => {
  const http = () => ({ ok: false, status: 429, headers: {}, text: 'rate limited secret-body-xyz' })
  const s = stubs(on, { config: JEV_ASSIST, env: { TYPESAFE_API_KEY: 'k-12345678' }, http })
  await call($)
  await call($)
  await call($)
  expect(s.toasts.length).toBe(1)
  expect(s.toasts[0]).toContain('http_429')
  expect(s.toasts[0]).toContain('original output kept')
  expect(s.toasts[0]).not.toContain('secret-body-xyz')
  expect(s.toasts[0]).not.toContain('k-12345678')
})

test('a missing key is announced too, as missing_key', async ($, on) => {
  const s = stubs(on, { config: JEV_ASSIST })
  await call($)
  expect(s.toasts.some((t) => t.includes('missing_key'))).toBe(true)
})

test('a healthy run shows no toast, but every decision is written to the debug log', async ($, on) => {
  const s = stubs(on, { config: ASSIST })
  await call($)
  expect(s.toasts).toEqual([])
  expect(s.logs.some((l) => l.startsWith('prune ok:'))).toBe(true)
})

test('an internal error is announced once and the original result is kept', async ($, on) => {
  const s = stubs(on, { config: ASSIST, failWrites: true })
  const out: any = await call($)
  await call($)
  expect(out.text).toBe('original')
  expect(s.toasts.filter((t) => t.includes('internal error')).length).toBe(1)
})

test('the key can come from Claude Code settings.json env', async ($, on) => {
  const s = stubs(on, { config: JEV_ASSIST, settingsEnv: { TYPESAFE_API_KEY: 'settings-env-key-5' }, http: () => ({ ok: false, status: 500, headers: {}, text: '' }) })
  await call($)
  expect(s.requests[0]!.init.headers.Authorization).toBe('Bearer settings-env-key-5')
  expect(JSON.stringify(s.written)).not.toContain('settings-env-key-5')
})

test('a key in the project settings.json is never used', async ($, on) => {
  const s = stubs(on, { config: JEV_ASSIST, projectSettingsEnv: { TYPESAFE_API_KEY: 'repo-key-9' }, http: () => ({ ok: false, status: 500, headers: {}, text: '' }) })
  await call($)
  expect(s.requests.length).toBe(0)
  expect(JSON.stringify(s.written)).not.toContain('repo-key-9')
})

test('key order: environment, then plugin setting, then settings.env', async ($, on) => {
  const http = () => ({ ok: false, status: 500, headers: {}, text: '' })
  const s = stubs(on, { config: JEV_ASSIST, env: { TYPESAFE_API_KEY: 'from-env-1' }, settingsEnv: { TYPESAFE_API_KEY: 'from-settings-3' }, http })
  await call($)
  expect(s.requests[0]!.init.headers.Authorization).toBe('Bearer from-env-1')
})

optsTest('plugin-setting key beats settings.env', { typesafe_api_key: 'from-plugin-2' }, async ($: any, on: any) => {
  const http = () => ({ ok: false, status: 500, headers: {}, text: '' })
  const s = stubs(on, { config: JEV_ASSIST, settingsEnv: { TYPESAFE_API_KEY: 'from-settings-3' }, http })
  await call($)
  expect(s.requests[0]!.init.headers.Authorization).toBe('Bearer from-plugin-2')
})

optsTest('the model setting is sent, and the model that answered is recorded', { model: 'jev-latest', typesafe_api_key: 'k-12345678' }, async ($: any, on: any) => {
  let sentModel = ''
  const http = (_u: string, init: any) => {
    const body = JSON.parse(init.body)
    sentModel = body.model
    const answers = Object.fromEntries(Object.keys(body.questions).map((id) => [id, { type: 'noul', noul: 0.01 }]))
    return { ok: true, status: 200, headers: {}, text: JSON.stringify({ model: 'jev-1.14.0', usage: { input_tokens: 5, output_tokens: 0 }, answers }) }
  }
  const s = stubs(on, { config: JEV_ASSIST, http })
  await call($)
  expect(sentModel).toBe('jev-latest')
  const record = decisions(s.written).find((d) => d.backend === 'jev')
  expect(record.reason).toBe('ok')
  expect(record.requested_model).toBe('jev-latest')
  expect(record.actual_model).toBe('jev-1.14.0')
})

optsTest('an invalid model setting falls back to the pinned default', { model: 'gpt-4', typesafe_api_key: 'k-12345678' }, async ($: any, on: any) => {
  let sentModel = ''
  const http = (_u: string, init: any) => { sentModel = JSON.parse(init.body).model; return { ok: false, status: 500, headers: {}, text: '' } }
  stubs(on, { config: JEV_ASSIST, http })
  await call($)
  expect(sentModel).toBe('jev-1.13.0')
})

optsTest('/jev doctor shows the model and where the key comes from', { model: 'jev-latest' }, async ($: any, on: any) => {
  stubs(on, { config: JEV_ASSIST, settingsEnv: { TYPESAFE_API_KEY: 'from-settings-3' } })
  const out = await jev($, 'doctor')
  expect(out.text).toContain('Jev model: jev-latest (plugin settings)')
  expect(out.text).toContain('Claude Code settings.json env')
  expect(out.text).not.toContain('from-settings-3')
})


// ---- v0.3: /jev on|off|mode|init and the measured receipt line
test('/jev on, off and mode change only the named plugin rows', async ($, on) => {
  const s = stubs(on, { config: JEV_ASSIST })
  const onOut = await jev($, 'on')
  expect(onOut.text).toContain('enable_all_projects = true')
  expect(onOut.text).toContain('ALL projects')
  await jev($, 'off')
  await jev($, 'mode assist')
  const bad = await jev($, 'mode shell')
  expect(bad.text).toContain('Usage')
  expect(s.configSets).toEqual([
    { key: 'jev-agent-kit.enable_all_projects', value: true },
    { key: 'jev-agent-kit.enable_all_projects', value: false },
    { key: 'jev-agent-kit.mode', value: 'assist' },
  ])
})

test('/jev on reports a refused change without claiming success', async ($, on) => {
  const s = stubs(on, { config: JEV_ASSIST, configDeny: true })
  const out = await jev($, 'on')
  expect(out.text).toContain('Not changed')
  expect(out.text).not.toContain('Set ')
  expect(s.configSets.length).toBe(1)
})

test('/jev init creates the project file once and never overwrites it', async ($, on) => {
  const s = stubs(on, {})
  const first = await jev($, 'init assist')
  expect(first.text).toContain('Created')
  expect(JSON.parse(s.written[CWD + '/.claude/jev-agent-kit.json']!)).toEqual({ schemaVersion: 1, enabled: true, mode: 'assist', backend: 'rules' })
  expect((await jev($, 'init bogus')).text).toContain('Usage')
})

test('/jev init leaves an existing project file alone', async ($, on) => {
  const t = stubs(on, { config: JEV_ASSIST })
  expect((await jev($, 'init')).text).toContain('already exists')
  expect(t.fsWrites.length).toBe(0)
})

test('the read-back line reports measured characters in and out', async ($, on) => {
  stubs(on, { config: ASSIST })
  const out = await call($)
  expect(out.result.stdout).toMatch(/\[Jev agent kit: pruned \d+ -> \d+ chars\. The full original is in the file \S+\/artifacts\/[a-f0-9]{32}\.log \(read it with your Read tool or cat\); the user can run \/jev readback [a-f0-9]{32}\]/)
})

test('after a read-back, assist stops rewriting for the rest of the session', async ($, on) => {
  stubs(on, { config: ASSIST })
  const first = await call($)
  const id = first.result.stdout.match(/readback ([a-f0-9]{32})/)[1]
  await jev($, 'readback ' + id)
  const second = await call($)
  expect(second.result.stdout).not.toContain('/jev readback')
  expect(second.result.stdout).toBe(longLog())
})

test('observe with the jev backend asks Jev but never rewrites (shadow mode)', async ($, on) => {
  const answers = (body: any) => ({ ok: true, status: 200, headers: {}, text: JSON.stringify({ model: 'jev-1.13.0', usage: { input_tokens: 5, output_tokens: 1 }, answers: Object.fromEntries(Object.keys(body.questions).map((k) => [k, { type: 'noul', noul: 0.9 }])) }) })
  const s = stubs(on, { config: { ...JEV_ASSIST, mode: 'observe' }, env: { TYPESAFE_API_KEY: 'fake-key-1234' }, http: (_u: string, init: any) => answers(JSON.parse(init.body)) })
  const out = await call($)
  expect(s.requests.length).toBeGreaterThan(0)
  expect(out.result.stdout).toBe(longLog())
})

test('/jev preset writes fixed fields only, lists names, rejects unknown names', async ($, on) => {
  const s = stubs(on, {})
  const list = await jev($, 'preset')
  expect(list.text).toContain('shadow-jev')
  expect((await jev($, 'preset __proto__')).text).toContain('Usage')
  expect((await jev($, 'preset constructor')).text).toContain('Usage')
  expect(s.fsWrites.length).toBe(0)
  expect((await jev($, 'preset shadow-jev')).text).toContain('Created')
  expect(JSON.parse(s.written[CWD + '/.claude/jev-agent-kit.json']!)).toEqual({ schemaVersion: 1, enabled: true, mode: 'observe', backend: 'jev' })
})

test('/jev savings reports counted characters for observe and never claims tokens or cost', async ($, on) => {
  stubs(on, { config: { ...JEV_ASSIST, backend: 'rules', mode: 'observe' } })
  await call($)
  const out = await jev($, 'savings')
  expect(out.text).toMatch(/observe: 1 logs, [1-9]\d* chars assist would have removed/)
  expect(out.text).toContain('assist: 0 logs rewritten')
  expect(out.text).toContain('not a token, cost or success measurement')
})

test('/jev savings counts what assist actually removed', async ($, on) => {
  stubs(on, { config: ASSIST })
  const rewritten = await call($)
  await jev($, 'savings').then((out: any) => {
    expect(out.text).toMatch(/assist: 1 logs rewritten, [1-9]\d* chars removed net/)
  })
  expect(rewritten.result.stdout).toContain('pruned ')
})

test('/jev savings does not count unrewritten assist rows or non-finite numbers', async ($, on) => {
  const row = (o: object) => JSON.stringify({ artifact_id: 'a'.repeat(32), reason: 'ok', mode: 'assist', ...o })
  const s = stubs(on, { config: ASSIST })
  await call($) // writes one real rewritten record
  const first = Object.keys(s.written).find((p) => p.includes('/decisions/'))!
  const dir = first.slice(0, first.lastIndexOf('/') + 1)
  s.written[dir + '1-aaaa.json'] = row({ input_chars: 500, delivered_chars: 500 })
  s.written[dir + '2-bbbb.json'] = row({ input_chars: 1e999, delivered_chars: 1 })
  s.written[dir + '3-cccc.json'] = '{not json'
  const out = await jev($, 'savings')
  expect(out.text).toMatch(/assist: 1 logs rewritten/)
  expect(out.text).not.toContain('Infinity')
})

test('/jev pane opens and closes the pane and reports a narrow terminal honestly', async ($, on) => {
  const s = stubs(on, { config: ASSIST })
  expect((await jev($, 'pane')).text).toContain('pane opened')
  expect((await jev($, 'pane close')).text).toContain('closed')
  expect(s.panes).toEqual(['open:jev-pane', 'close:jev-pane'])
})

test('/jev pane says it is waiting when the terminal is too narrow, and survives an error', async ($, on) => {
  stubs(on, { config: ASSIST, paneUnplaced: true })
  expect((await jev($, 'pane')).text).toContain('waiting')
})

test('/jev pane failure is reported, never thrown', async ($, on) => {
  stubs(on, { config: ASSIST, paneThrows: true })
  expect((await jev($, 'pane')).text).toContain('Could not open the pane')
})

test('the pane draws counted characters and recent decisions, and nothing secret', async ($, on) => {
  stubs(on, { config: ASSIST, env: { TYPESAFE_API_KEY: 'pane-key-123456789' } })
  await call($)
  const tree: any = await ($ as any).ui.render({ surface: 'terminal', component: 'Pane', requestId: 'jev-pane', props: {} })
  const text = JSON.stringify(tree)
  expect(text).toContain('chars removed net')
  expect(text).toContain('logs rewritten')
  expect(text).toContain('/jev pane close')
  expect(text).not.toContain('pane-key-123456789')
})

test('the model can read the original from the file named in the receipt, and that stops rewriting', async ($, on) => {
  const s = stubs(on, { config: ASSIST })
  const first: any = await call($)
  const file = first.result.stdout.match(/in the file (\S+\.log) /)[1]
  expect(Object.keys(s.written)).toContain(file)
  // The model now cats that file: the output must come back whole, and later output too.
  const second: any = await $.tool.call({ tool: 'Bash', command: 'cat ' + file })
  expect(second.result.stdout).toBe(longLog())
  const third: any = await call($)
  expect(third.result.stdout).toBe(longLog())
})

test('a command that merely mentions a different path does not pause pruning', async ($, on) => {
  stubs(on, { config: ASSIST })
  const out: any = await $.tool.call({ tool: 'Bash', command: 'cat /somewhere/else/artifacts/x.log' })
  expect(out.result.stdout).toContain('/jev readback')
})

// ---- v0.6: host truncation (Claude Code cuts Bash output at 30000 characters before hooks run)
const bigLog = (chars: number) => {
  let text = ''
  for (let i = 0; text.length < chars; i++) text += `progress item ${i}\n`
  return text.slice(0, chars)
}
const withStdout = (stdout: string) => ({ result: { stdout, stderr: '', interrupted: false, isImage: false }, text: 'original' })

test('output cut at the host cap is left alone and recorded, never rewritten', async ($, on) => {
  const text = bigLog(30000)
  const s = stubs(on, { config: ASSIST, tool: withStdout(text) })
  const out: any = await call($)
  expect(out.result.stdout).toBe(text)
  expect(Object.values(s.written).some((v) => v.includes('host_truncated_output'))).toBe(true)
  expect(Object.keys(s.written).some((p) => p.includes('/artifacts/'))).toBe(false)
})

test('output just under the cap is still pruned', async ($, on) => {
  const text = bigLog(25000)
  stubs(on, { config: ASSIST, tool: withStdout(text) })
  const out: any = await call($)
  expect(out.result.stdout).not.toBe(text)
  expect(out.result.stdout).toContain('/jev readback')
})

test('the host cap follows BASH_MAX_OUTPUT_LENGTH', async ($, on) => {
  const text = bigLog(12000)
  stubs(on, { config: ASSIST, tool: withStdout(text), env: { BASH_MAX_OUTPUT_LENGTH: '12000' } })
  const out: any = await call($)
  expect(out.result.stdout).toBe(text)
})

for (const bad of ['-5', 'abc', '0', 'NaN']) {
  test('a nonsense BASH_MAX_OUTPUT_LENGTH (' + bad + ') falls back to the default instead of switching pruning off', async ($, on) => {
    const text = bigLog(25000)
    stubs(on, { config: ASSIST, tool: withStdout(text), env: { BASH_MAX_OUTPUT_LENGTH: bad } })
    const out: any = await call($)
    expect(out.result.stdout).not.toBe(text)
  })
}
