import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { JevError } from '../../core/contracts.ts'
import { httpTransport, loadEnv, privateWrite, readback, stateBase } from '../io.ts'

const tmp = () => mkdtempSync(join(tmpdir(), 'jev-io-'))

test('readback restores stored originals and rejects bad ids', () => {
  const root = tmp()
  mkdirSync(join(root, 'artifacts'))
  writeFileSync(join(root, 'artifacts', 'a'.repeat(32) + '.log'), 'original')
  assert.equal(readback(root, 'a'.repeat(32)), 'original')
  for (const bad of ['../x', 'A'.repeat(32), 'a'.repeat(31), '', 'a'.repeat(32) + '/..', 'a'.repeat(32) + '\n']) {
    assert.throws(() => readback(root, bad), /invalid_artifact_id/, JSON.stringify(bad))
  }
})

test('private files are 0600 and every new directory level is 0700, whatever the umask', () => {
  const root = tmp()
  const old = process.umask(0o022)
  try {
    const target = join(root, 'a', 'b', 'c', 'f.log')
    privateWrite(target, 'x')
    assert.equal(statSync(target).mode & 0o777, 0o600)
    for (const dir of [join(root, 'a', 'b', 'c'), join(root, 'a', 'b'), join(root, 'a')]) assert.equal(statSync(dir).mode & 0o777, 0o700, dir)
    assert.equal(process.umask(), 0o022, 'umask is restored')
  } finally {
    process.umask(old)
  }
})

test('state dir expansion; relative and other-user values are ignored', () => {
  const home = '/home/u'
  const fallback = join(home, '.cache', 'jev-agent-kit')
  const cases: Record<string, string> = { '~/x': '/home/u/x', '~': '/home/u', '~other/x': fallback, 'relative/dir': fallback, '/abs/dir': '/abs/dir' }
  for (const [raw, expected] of Object.entries(cases)) assert.equal(stateBase({ JEV_STATE_DIR: raw }, home), expected, raw)
  assert.equal(stateBase({}, home), fallback)
  assert.ok(stateBase({}).startsWith(homedir()))
})

test('env file is data, not code; only the key is read', () => {
  const dir = tmp()
  const file = join(dir, 'env')
  writeFileSync(file, 'UNRELATED=ignore\nTYPESAFE_API_KEY="$(not_executed)"\n')
  const env: Record<string, string | undefined> = {}
  loadEnv(file, env)
  assert.equal(env.TYPESAFE_API_KEY, '$(not_executed)')
  assert.equal(env.UNRELATED, undefined)
  const kept: Record<string, string | undefined> = { TYPESAFE_API_KEY: 'already' }
  loadEnv(file, kept)
  assert.equal(kept.TYPESAFE_API_KEY, 'already', 'an existing environment value wins')
  const placeholder = join(dir, 'p')
  writeFileSync(placeholder, 'TYPESAFE_API_KEY=REPLACE_ME\n')
  const none: Record<string, string | undefined> = {}
  loadEnv(placeholder, none)
  assert.equal(none.TYPESAFE_API_KEY, undefined)
})

const reply = (status: number, text: string) => (async () => new Response(text, { status })) as unknown as typeof fetch
const reason = async (run: () => Promise<unknown>) => {
  try {
    await run()
  } catch (error) {
    assert.ok(error instanceof JevError)
    return error.reason
  }
  return 'no error'
}

test('transport failures become fixed reason codes and never carry the key or the body', async () => {
  const key = 'fake-key-123456789'
  const body = { model: 'jev-1.13.0', state: 'x', questions: {} }
  assert.equal(await reason(() => httpTransport(undefined)(body)), 'missing_key')
  assert.equal(await reason(() => httpTransport('REPLACE_ME')(body)), 'missing_key')
  assert.equal(await reason(() => httpTransport(key, 3, reply(429, 'secret body ' + key))(body)), 'http_429')
  assert.equal(await reason(() => httpTransport(key, 3, reply(200, 'not json'))(body)), 'transport_or_json_error')
  assert.equal(await reason(() => httpTransport(key, 3, (async () => { throw new TypeError('redirect mode is set to error') }) as unknown as typeof fetch)(body)), 'transport_or_json_error')
  assert.equal(await reason(() => httpTransport(key, 3, reply(200, 'x'.repeat(260_000)))(body)), 'response_too_large')
  assert.equal(await reason(() => httpTransport(key)({ ...body, state: 'x'.repeat(260_000) })), 'request_too_large')
  const slow = ((_url: string, init: RequestInit) => new Promise((_, reject) => {
    init.signal!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
  })) as unknown as typeof fetch
  assert.equal(await reason(() => httpTransport(key, 0.05, slow)(body)), 'timeout')
})

test('the request goes to the fixed endpoint, with redirects disabled, and returns parsed JSON', async () => {
  let seen: { url: string; init: RequestInit } | undefined
  const ok = (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response('{"model":"jev-1.13.0"}') }) as unknown as typeof fetch
  const out = await httpTransport('fake-key-123456789', 3, ok)({ model: 'jev-1.13.0' })
  assert.deepEqual(out, { model: 'jev-1.13.0' })
  assert.equal(seen!.url, 'https://api.typesafe.ai/v1/systemone')
  assert.equal(seen!.init.redirect, 'error')
  assert.equal((seen!.init.headers as Record<string, string>).Authorization, 'Bearer fake-key-123456789')
})

test('the deadline covers a stalled body and the size cap applies while reading', async () => {
  const stalled = (async () => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{"a":')) } /* never closes */ }))) as unknown as typeof fetch
  assert.equal(await reason(() => httpTransport('fake-key-123456789', 0.1, stalled)({ model: 'jev-1.13.0' })), 'timeout')
  let pulls = 0
  const endless = (async () => new Response(new ReadableStream({ pull(c) { pulls += 1; c.enqueue(new Uint8Array(50_000)) } }))) as unknown as typeof fetch
  assert.equal(await reason(() => httpTransport('fake-key-123456789', 3, endless)({ model: 'jev-1.13.0' })), 'response_too_large')
  assert.ok(pulls < 20, 'stopped reading soon after the cap')
})
