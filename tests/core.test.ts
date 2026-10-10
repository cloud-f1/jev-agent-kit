import { expect, test } from 'claude-code/testing'
import { defaultConfig, mergeConfig, parseEnvFile, pluginKey, pluginModel, userDefaults, validateConfig } from '../core/config.ts'
import { isJevModel, JevError, MODEL } from '../core/contracts.ts'
import { digestString } from '../core/hash.ts'
import { collapseRepeats, jevNotAsked, prune, redact, splitLines, validateNouls, validateResponse } from '../core/prune.ts'
import golden from './fixtures/golden.ts'

const usage = { input_tokens: 100, output_tokens: 0 }
const lines = (n: number) => Array.from({ length: n }, (_, i) => `progress item ${i}\n`)

test('digests match the frozen golden fixture', async () => {
  for (const [value, expected] of Object.entries(golden.digests)) {
    expect((await digestString(value)).slice(0, 24)).toBe(expected)
  }
})

test('rules pruning matches the golden fixture on every case', async () => {
  for (const c of golden.cases) {
    const { output, meta } = await prune(c.input, { backend: 'rules', goal: '', threshold: 0.8 })
    expect(output).toBe(c.expected_output)
    expect(meta.input_chars).toBe(c.expected_input_chars)
    expect(meta.reason).toBe(c.expected_reason)
  }
})

test('splitLines keeps terminators and splits on the same separators as the golden fixtures', () => {
  expect(splitLines('a\r\nb\nc')).toEqual(['a\r\n', 'b\n', 'c'])
  expect(splitLines('a b\x0bc')).toEqual(['a ', 'b\x0b', 'c'])
  expect(splitLines('')).toEqual([])
  expect(splitLines('x\n')).toEqual(['x\n'])
})

test('redact removes keys and tokens but keeps ordinary text', () => {
  const text = 'api_key=abc123 and Authorization: Bearer xyzSECRET99 sk-abcdefghijkl12345 ok'
  const out = redact(text)
  for (const secret of ['abc123', 'xyzSECRET99', 'sk-abcdefghijkl']) expect(out).not.toContain(secret)
  expect(out).toContain('ok')
})

test('redaction matches the golden fixture and catches bearer, JSON and quoted secrets', () => {
  for (const r of golden.redactions) expect(redact(r.input)).toBe(r.expected)
  const leaks: Array<[string, string]> = [
    ['Authorization: Bearer abcdefSECRET123', 'abcdefSECRET123'],
    ['{"api_key": "SECRETJSON123", "password":"PW99"}', 'SECRETJSON123'],
    ['{"api_key": "SECRETJSON123", "password":"PW99"}', 'PW99'],
    ['password: "quoted secret"', 'secret'],
    ["token='single quoted value'", 'single quoted value'],
    ['Basic dXNlcjpwYXNz1234', 'dXNlcjpwYXNz1234'],
  ]
  for (const [input, secret] of leaks) expect(redact(input)).not.toContain(secret)
  expect(redact('tokenizer is fine')).toBe('tokenizer is fine')
})

test('character counts use code points', async () => {
  const text = Array.from({ length: 120 }, (_, i) => `\u{1F600} line ${i}\n`).join('')
  const { meta } = await prune(text, { backend: 'rules', goal: '', threshold: 0.8 })
  expect(meta.input_chars).toBe(Array.from(text).length)
  expect(meta.input_chars).toBeLessThan(text.length)
})

test('response validation accepts integral numbers the way JSON does (5.0 is 5)', () => {
  expect(validateResponse({ model: MODEL, usage: { input_tokens: 5.0, output_tokens: 0 } }).usage.input_tokens).toBe(5)
  expect(validateConfig({ schemaVersion: 1.0 }).schemaVersion).toBe(1)
})

test('config: defaults are disabled and strict validation rejects bad input', () => {
  expect(defaultConfig().enabled).toBe(false)
  expect(validateConfig(undefined).mode).toBe('observe')
  expect(validateConfig({ enabled: true, mode: 'assist' }).mode).toBe('assist')
  const bad: unknown[] = [
    { endpoint: 'https://evil.example' }, { apiKey: 'x' }, { enabled: 'yes' }, { mode: 'enforce' },
    { backend: 'other' }, { schemaVersion: 2 }, { minimumChars: -1 }, { timeoutSeconds: 99 },
    { keepThreshold: 1.5 }, { retentionDays: 0 }, { minimumChars: Number.NaN }, [], 'text',
  ]
  for (const raw of bad) expect(() => validateConfig(raw)).toThrow()
})

test('env file: only TYPESAFE_API_KEY is read, placeholders ignored, no evaluation', () => {
  expect(parseEnvFile('# c\nOTHER=1\nTYPESAFE_API_KEY="k-123"\n')).toBe('k-123')
  expect(parseEnvFile('TYPESAFE_API_KEY=REPLACE_ME')).toBeUndefined()
  expect(parseEnvFile('OTHER=$(whoami)')).toBeUndefined()
  expect(parseEnvFile('TYPESAFE_API_KEY=$(not_executed)')).toBe('$(not_executed)')
})

test('a pinned model must answer as itself; only jev-latest may resolve to another name', () => {
  expect(() => validateResponse({ model: 'jev-1.99.0', usage }, MODEL)).toThrow()
  expect(validateResponse({ model: MODEL, usage }, MODEL).model).toBe(MODEL)
  expect(validateResponse({ model: 'jev-1.99.0', usage }, 'jev-latest').model).toBe('jev-1.99.0')
})

test('response validation rejects wrong model, bad usage, bad probabilities', () => {
  expect(() => validateResponse({ model: 'other', usage })).toThrow()
  expect(() => validateResponse({ model: MODEL, usage: { input_tokens: -1, output_tokens: 0 } })).toThrow()
  expect(() => validateResponse({ model: MODEL, usage: { input_tokens: 1.5, output_tokens: 0 } })).toThrow()
  expect(() => validateResponse(null)).toThrow()
  expect(validateResponse({ model: MODEL, usage }).usage.input_tokens).toBe(100)
  const noul = (v: unknown) => ({ answers: { b1: { type: 'noul', noul: v } } })
  expect(() => validateNouls(noul(Number.NaN), ['b1'])).toThrow()
  expect(() => validateNouls(noul(1.2), ['b1'])).toThrow()
  expect(() => validateNouls({ answers: {} }, ['b1'])).toThrow()
  expect(() => validateNouls({ answers: { b1: { type: 'choice', noul: 0.5 } } }, ['b1'])).toThrow()
  expect(validateNouls(noul(0.9), ['b1']).b1).toBe(0.9)
})

function longLog() {
  const l = lines(320)
  l[141] = 'ERROR build: expected contract, got invalid\n'
  l[47] = 'IMPORTANT_BUSINESS_CONTEXT tenant region explains this\n'
  return l.join('')
}

test('jev backend adds relevant blocks and never drops error blocks', async () => {
  const text = longLog()
  const transport = async (body: Record<string, any>) => ({
    model: MODEL, usage,
    answers: Object.fromEntries(Object.keys(body.questions).map((id) => [id, {
      type: 'noul', noul: body.state.blocks.find((b: any) => b.id === id).text.includes('IMPORTANT_BUSINESS_CONTEXT') ? 0.99 : 0.01,
    }])),
  })
  const { output, meta } = await prune(text, { backend: 'jev', goal: 'diagnose', threshold: 0.8, transport })
  expect(meta.reason).toBe('ok')
  expect(meta.api_input_tokens).toBe(100)
  expect(meta.cost_complete).toBe(true)
  expect(output).toContain('ERROR build')
  expect(output).toContain('IMPORTANT_BUSINESS_CONTEXT')
  expect(output.length).toBeLessThan(text.length)
})

test('jev_asked is true only when a request was really sent to the transport', async () => {
  let calls = 0
  const transport = async (body: Record<string, any>) => {
    calls += 1
    return { model: MODEL, usage, answers: Object.fromEntries(Object.keys(body.questions).map((id) => [id, { type: 'noul', noul: 0.01 }])) }
  }
  const asked = await prune(longLog(), { backend: 'jev', goal: 'g', threshold: 0.8, transport })
  expect(calls).toBe(1)
  expect(asked.meta.jev_asked).toBe(true)
  // Every block contains an error word, so every block is pinned and there is nothing to ask Jev.
  const allErrors = Array.from({ length: 400 }, (_, i) => 'ERROR unit test failed ' + i + '\n').join('')
  const none = await prune(allErrors, { backend: 'jev', goal: 'g', threshold: 0.8, transport })
  expect(calls).toBe(1)
  expect(none.meta.jev_asked).toBe(false)
  expect(none.meta.actual_model).toBe(null)
  expect(none.meta.api_input_tokens).toBe(null)
  const rules = await prune(longLog(), { backend: 'rules', goal: 'g', threshold: 0.8 })
  expect('jev_asked' in rules.meta).toBe(false)
})

test('jev backend falls back to the exact original on every failure', async () => {
  const text = longLog()
  const failing: Array<[string, (b: any) => Promise<unknown>]> = [
    ['http_429', async () => { throw new JevError('http_429') }],
    ['invalid_response', async () => { throw new Error('boom with secret detail') }],
    ['invalid_model', async () => ({ model: 'x', usage, answers: {} })],
    ['invalid_answers', async () => ({ model: MODEL, usage, answers: {} })],
  ]
  for (const [reason, transport] of failing) {
    const { output, meta } = await prune(text, { backend: 'jev', goal: 'g', threshold: 0.8, transport })
    expect(output).toBe(text)
    expect(meta.reason).toBe(reason)
    expect(meta.api_input_tokens).toBeNull()
  }
  const none = await prune(text, { backend: 'jev', goal: 'g', threshold: 0.8 })
  expect(none.output).toBe(text)
  expect(none.meta.reason).toBe('missing_transport')
})

test('over-budget and oversized inputs are never sent', async () => {
  let calls = 0
  const transport = async () => { calls += 1; return {} }
  const huge = lines(2000).join('')
  const budget = await prune(huge, { backend: 'jev', goal: 'g', threshold: 0.8, transport })
  expect(budget.meta.reason).toBe('budget_fallback_original')
  const tooBig = await prune('x'.repeat(300_000), { backend: 'jev', goal: 'g', threshold: 0.8, transport })
  expect(tooBig.meta.reason).toBe('input_too_large')
  expect(calls).toBe(0)
})

test('the goal is redacted before it leaves the machine', async () => {
  let sent = ''
  const transport = async (body: Record<string, any>) => { sent = JSON.stringify(body); throw new JevError('stop') }
  await prune(longLog(), { backend: 'jev', goal: 'debug with api_key=SUPERSECRETVALUE', threshold: 0.8, transport })
  expect(sent).not.toContain('SUPERSECRETVALUE')
  expect(sent).toContain('[REDACTED]')
})

test('settings layer: defaults < plugin settings < project file, with sources', () => {
  const { config, sources } = mergeConfig({ mode: 'assist', retention_days: 14 }, { mode: 'observe', enabled: true })
  expect(config.mode).toBe('observe')
  expect(config.retentionDays).toBe(14)
  expect(config.enabled).toBe(true)
  expect(sources.mode).toBe('project file')
  expect(sources.retentionDays).toBe('plugin settings')
  expect(sources.backend).toBe('default')
})

test('settings layer: a bad plugin option is ignored, a bad project file is not', () => {
  expect(userDefaults({ mode: 'bogus', minimum_chars: 5000, keep_threshold: 7 })).toEqual({ minimumChars: 5000 })
  expect(mergeConfig({ mode: 'bogus' }, undefined).config.mode).toBe('observe')
  expect(() => mergeConfig({}, { endpoint: 'https://evil.example' })).toThrow()
  expect(() => mergeConfig({}, { mode: 'nope' })).toThrow()
  expect(userDefaults(null)).toEqual({})
  expect(userDefaults('x')).toEqual({})
})

test('settings layer: opting in everywhere is a user-level choice a project can still refuse', () => {
  expect(mergeConfig({ enable_all_projects: true }, undefined).config.enabled).toBe(true)
  expect(mergeConfig({ enable_all_projects: true }, { enabled: false }).config.enabled).toBe(false)
  expect(mergeConfig({}, undefined).config.enabled).toBe(false)
})

test('settings layer matches every golden merge case', () => {
  for (const c of golden.merges) {
    if ('error' in c.expected) {
      expect(() => mergeConfig(c.options, c.project ?? undefined)).toThrow()
    } else {
      expect(mergeConfig(c.options, c.project ?? undefined).config).toEqual(c.expected)
    }
  }
})

test('plugin API key: only a real value counts, and it is never part of the config', () => {
  expect(pluginKey({ typesafe_api_key: 'k-123' })).toBe('k-123')
  expect(pluginKey({ typesafe_api_key: '' })).toBeUndefined()
  expect(pluginKey({ typesafe_api_key: 'REPLACE_ME' })).toBeUndefined()
  expect(pluginKey(null)).toBeUndefined()
  expect(JSON.stringify(mergeConfig({ typesafe_api_key: 'k-123' }, undefined).config)).not.toContain('k-123')
})

test('model: any jev-* name is allowed, nothing else', () => {
  for (const ok of ['jev-1.13.0', 'jev-latest', 'jev-2.0.0-beta']) expect(isJevModel(ok)).toBe(true)
  for (const bad of ['gpt-4', 'jev', 'jev-', 'jev-a b', 'jev-' + 'x'.repeat(41), '', 5, null, 'JEV-1']) expect(isJevModel(bad)).toBe(false)
  expect(pluginModel({ model: 'jev-latest' })).toBe('jev-latest')
  expect(pluginModel({ model: 'evil-model' })).toBeUndefined()
  expect(pluginModel(null)).toBeUndefined()
  // A project file can never set it.
  expect(() => mergeConfig({}, { model: 'jev-latest' })).toThrow()
})

test('model: the response may name a newer jev-* model; requested and actual are both recorded', async () => {
  let requested = ''
  const transport = async (body: Record<string, any>) => {
    requested = body.model
    return {
      model: 'jev-1.14.0', usage,
      answers: Object.fromEntries(Object.keys(body.questions).map((id) => [id, { type: 'noul', noul: 0.01 }])),
    }
  }
  const { meta } = await prune(longLog(), { backend: 'jev', goal: 'g', threshold: 0.8, transport, model: 'jev-latest' })
  expect(requested).toBe('jev-latest')
  expect(meta.reason).toBe('ok')
  expect(meta.requested_model).toBe('jev-latest')
  expect(meta.actual_model).toBe('jev-1.14.0')
  expect(() => validateResponse({ model: 'gpt-4', usage })).toThrow()
})

test('model: default request is the pinned model, and rules runs record no model', async () => {
  let requested = ''
  await prune(longLog(), { backend: 'jev', goal: 'g', threshold: 0.8, transport: async (b: Record<string, any>) => { requested = b.model; throw new JevError('stop') } })
  expect(requested).toBe(MODEL)
  const rules = await prune(longLog(), { backend: 'rules', goal: 'g', threshold: 0.8 })
  expect(rules.meta.requested_model).toBeUndefined()
})

test('collapsing repeated warnings never loses an error-class line and keeps the count honest', () => {
  const warn = (n: number, tag = 'deprecated api') => Array.from({ length: n }, (_, i) => `WARNING: ${tag} call #${i} at step ${i * 7}\n`)
  const errors = ['ERROR boom 1\n', 'FAILED test_a\n', 'Traceback (most recent call last):\n', '  File "x.py", line 3\n', 'AssertionError: expected 1\n']
  const text = [...warn(12), errors[0], ...warn(20), errors[1], ...warn(8, 'warn error code'), errors[2], errors[3], errors[4], ...warn(6)].join('')
  const out = collapseRepeats(text)
  for (const e of errors) expect(out).toContain(e)
  expect(out.split('\n').filter((l) => l.includes('warn error code')).length).toBe(8) // error-class: untouched
  expect(out).toContain('[9 similar lines omitted (original lines 3-11)]')
  expect(out.length).toBeLessThan(text.length)
  expect(collapseRepeats(warn(5).join(''))).toBe(warn(5).join('')) // below the run threshold
})

test('a failed request still counts as asked (jev_asked true) but is never reason ok', async () => {
  const transport = async () => { throw new JevError('http_429') }
  const { meta } = await prune(longLog(), { backend: 'jev', goal: 'g', threshold: 0.8, transport })
  expect(meta.jev_asked).toBe(true)
  expect(meta.reason).toBe('http_429')
  expect(meta.actual_model).toBe(null)
  expect(jevNotAsked(meta)).toBe(false)
})

test('jevNotAsked recognizes new and older records, and nothing else', () => {
  expect(jevNotAsked({ backend: 'jev', reason: 'ok', jev_asked: false })).toBe(true)
  expect(jevNotAsked({ backend: 'jev', reason: 'ok', jev_asked: true, actual_model: 'jev-1.13.0' })).toBe(false)
  // Older records had no jev_asked: no answering model means no request was sent.
  expect(jevNotAsked({ backend: 'jev', reason: 'ok', actual_model: null, api_input_tokens: null })).toBe(true)
  expect(jevNotAsked({ backend: 'jev', reason: 'ok', actual_model: 'jev-1.13.0' })).toBe(false)
  expect(jevNotAsked({ backend: 'jev', reason: 'http_429', jev_asked: false })).toBe(false)
  expect(jevNotAsked({ backend: 'rules', reason: 'ok', jev_asked: false })).toBe(false)
  for (const odd of [null, undefined, 'x', 7, [], {}]) expect(jevNotAsked(odd)).toBe(false)
})
