import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import * as rc from '../../scripts/release-check.ts'

interface Options { ts?: string; plugin?: string; pkg?: string; changelog?: string; classicHooks?: boolean; modules?: string[]; extra?: object; market?: string[] }
function makeRepo(o: Options = {}) {
  const { ts = '0.2.0', plugin = '0.2.0', pkg = '0.2.0', changelog = '## 0.2.0 (2026-10-10)\n', classicHooks = false, modules = ['./register.ts'], extra = {}, market = ['jev-agent-kit'] } = o
  const root = mkdtempSync(join(tmpdir(), 'jev-rc-'))
  for (const d of ['core', 'hooks', '.claude-plugin']) mkdirSync(join(root, d))
  writeFileSync(join(root, 'core', 'contracts.ts'), `export const VERSION = '${ts}'\n`)
  writeFileSync(join(root, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'jev-agent-kit', version: plugin, ...extra }))
  writeFileSync(join(root, '.claude-plugin', 'marketplace.json'), JSON.stringify({ plugins: market.map((name) => ({ name })) }))
  writeFileSync(join(root, 'hooks', 'hooks.json'), JSON.stringify({ modules, ...(classicHooks ? { hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [] }] } } : {}) }))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'x', version: pkg }))
  for (const m of modules) writeFileSync(join(root, 'hooks', m), 'export function register() {}\n')
  writeFileSync(join(root, 'CHANGELOG.md'), '# Changelog\n\n' + changelog)
  return root
}
const by = (results: rc.Result[]) => Object.fromEntries(results.map((r) => [r.name, r.status]))

test('all version places agree', () => assert.equal(by(rc.checkVersions(makeRepo()))['versions agree'], rc.PASS))

test('each file drifting fails', () => {
  for (const field of ['ts', 'plugin', 'pkg'] as const) assert.equal(by(rc.checkVersions(makeRepo({ [field]: '0.1.0' })))['versions agree'], rc.FAIL, field)
  assert.equal(by(rc.checkVersions(makeRepo({ changelog: '## 0.1.0 (2026-01-01)\n' })))['versions agree'], rc.FAIL)
})

test('a missing version marker fails instead of passing', () => {
  const root = makeRepo()
  writeFileSync(join(root, 'core', 'contracts.ts'), '// no version here\n')
  assert.equal(by(rc.checkVersions(root))['versions agree'], rc.FAIL)
})

test('release requires a dated changelog; a plain heading is accepted', () => {
  const root = makeRepo({ changelog: '## 0.2.0 (unreleased)\n' })
  assert.equal(by(rc.checkVersions(root, false))['changelog dated for release'], undefined)
  assert.equal(by(rc.checkVersions(root, true))['changelog dated for release'], rc.FAIL)
  for (const heading of ['## 0.2.0 (2026-10-10)\n', '## 0.2.0\n']) assert.equal(by(rc.checkVersions(makeRepo({ changelog: heading }), true))['changelog dated for release'], rc.PASS)
})

test('manifest checks: consistent passes; defaultEnabled:false, classic hooks, missing plugin/module, bad JSON fail', () => {
  assert.equal(rc.checkManifests(makeRepo())[0]!.status, rc.PASS)
  const dflt = rc.checkManifests(makeRepo({ extra: { defaultEnabled: false } }))[0]!
  assert.equal(dflt.status, rc.FAIL)
  assert.match(dflt.detail, /defaultEnabled/)
  const classic = rc.checkManifests(makeRepo({ classicHooks: true }))[0]!
  assert.equal(classic.status, rc.FAIL)
  assert.match(classic.detail, /classic hooks/)
  assert.equal(rc.checkManifests(makeRepo({ market: ['other'] }))[0]!.status, rc.FAIL)
  const gone = makeRepo()
  unlinkSync(join(gone, 'hooks', 'register.ts'))
  assert.equal(rc.checkManifests(gone)[0]!.status, rc.FAIL)
  const bad = makeRepo()
  writeFileSync(join(bad, '.claude-plugin', 'plugin.json'), '{not json')
  assert.equal(rc.checkManifests(bad)[0]!.status, rc.FAIL)
})

test('secret scan: clean files pass; every kind is detected and the secret is never echoed', () => {
  assert.equal(rc.scanSecrets({ 'a.md': 'TYPESAFE_API_KEY=REPLACE_ME\nexport TYPESAFE_API_KEY=...' }).status, rc.PASS)
  const samples = {
    'k1.txt': 'key sk-' + 'a'.repeat(24), 'k2.txt': 'tok ghp_' + 'b'.repeat(30), 'k3.txt': 'AKIA' + 'C'.repeat(16),
    'k4.txt': '-----BEGIN RSA PRIVATE KEY-----', 'k5.txt': 'TYPESAFE_API_KEY=realvalue12345',
  }
  const out = rc.scanSecrets(samples)
  assert.equal(out.status, rc.FAIL)
  for (const path of Object.keys(samples)) assert.ok(out.detail.includes(path))
  for (const secret of ['a'.repeat(24), 'b'.repeat(30), 'realvalue12345']) assert.ok(!out.detail.includes(secret))
})

test('exempt paths are skipped, look-alikes are not', () => {
  const fake = 'sk-' + 'a'.repeat(24)
  for (const path of ['scripts/release-check.ts', 'tests/fixtures/x.json', 'cli/tests/x.spec.ts']) assert.equal(rc.scanSecrets({ [path]: fake }).status, rc.PASS, path)
  for (const path of ['src/x.ts', 'mytests/x.ts', 'cli/x.ts']) assert.equal(rc.scanSecrets({ [path]: fake }).status, rc.FAIL, path)
})

test('quoted and JSON-style keys are caught; the placeholder is not', () => {
  for (const text of ['TYPESAFE_API_KEY="ts_live_abcdef123456"', "TYPESAFE_API_KEY='ts_live_abcdef123456'", '{"TYPESAFE_API_KEY": "ts_live_abcdef123456"}', 'TYPESAFE_API_KEY: ts_live_abcdef123456']) {
    assert.equal(rc.scanSecrets({ 'x.json': text }).status, rc.FAIL, text)
  }
  assert.equal(rc.scanSecrets({ x: 'TYPESAFE_API_KEY="REPLACE_ME"' }).status, rc.PASS)
})

test('a non-UTF-8 tracked file is still scanned', () => {
  const root = mkdtempSync(join(tmpdir(), 'jev-git-'))
  spawnSync('git', ['init', '-q'], { cwd: root })
  writeFileSync(join(root, 'latin.txt'), Buffer.from('caf\xe9 TYPESAFE_API_KEY=ts_live_abcdef123456\n', 'latin1'))
  spawnSync('git', ['add', '.'], { cwd: root })
  const files = rc.trackedFiles(root)!
  assert.ok('latin.txt' in files)
  assert.equal(rc.scanSecrets(files).status, rc.FAIL)
})

test('validation summary allows only the known CLAUDE.md warning', () => {
  const ok = { success: true, manifest: { errors: [], warnings: [] }, contents: [{ errors: [], warnings: [{ message: 'CLAUDE.md at the plugin root is not loaded as project context.' }] }] }
  assert.equal(rc.summarizeValidation(ok).status, rc.PASS)
  assert.equal(rc.summarizeValidation({ success: true, manifest: { errors: [], warnings: [{ message: 'No description' }] }, contents: [] }).status, rc.FAIL)
  assert.equal(rc.summarizeValidation({ success: false, manifest: { errors: [{ message: 'bad' }], warnings: [] }, contents: [] }).status, rc.FAIL)
  assert.equal(rc.summarizeValidation({ success: false }).status, rc.FAIL)
})

test('gate semantics: SKIPPED is fine in dev but fails a release; FAIL always blocks', () => {
  const results: rc.Result[] = [{ name: 'a', status: rc.PASS, detail: '' }, { name: 'b', status: rc.SKIPPED, detail: 'cli missing' }]
  assert.equal(rc.evaluate(results, false), 0)
  assert.equal(rc.evaluate(results, true), 1)
  for (const release of [false, true]) assert.equal(rc.evaluate([{ name: 'a', status: rc.FAIL, detail: '' }], release), 1)
})

test('run steps: a missing tool is SKIPPED, a failing command FAILs with its tail, a passing one passes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jev-step-'))
  assert.equal(rc.runStep('x', ['definitely-not-a-real-binary-xyz'], dir, 'tool absent').status, rc.SKIPPED)
  const failing = rc.runStep('x', [process.execPath, '-e', 'console.log("boom"); process.exit(3)'], dir, '')
  assert.equal(failing.status, rc.FAIL)
  assert.match(failing.detail, /boom/)
  assert.equal(rc.runStep('x', [process.execPath, '-e', ''], dir, '').status, rc.PASS)
})

test('the node-tests step cannot pass on zero or skipped tests', () => {
  const root = mkdtempSync(join(tmpdir(), 'jev-nt-'))
  assert.equal(rc.nodeTests(root, []).status, rc.FAIL)
  writeFileSync(join(root, 'none.spec.ts'), "import { test } from 'node:test'\ntest.skip('x', () => {})\n")
  assert.equal(rc.nodeTests(root, ['none.spec.ts']).status, rc.FAIL)
  writeFileSync(join(root, 'ok.spec.ts'), "import { test } from 'node:test'\ntest('x', () => {})\n")
  assert.equal(rc.nodeTests(root, ['ok.spec.ts']).status, rc.PASS)
  writeFileSync(join(root, 'bad.spec.ts'), "import { test } from 'node:test'\nimport assert from 'node:assert'\ntest('x', () => assert.equal(1, 2))\n")
  assert.equal(rc.nodeTests(root, ['bad.spec.ts']).status, rc.FAIL)
})

test('a stale package-lock.json version fails the version check; no lockfile is fine', () => {
  const root = makeRepo()
  assert.equal(by(rc.checkVersions(root))['versions agree'], rc.PASS)
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ version: '0.2.0', packages: { '': { version: '0.2.0' } } }))
  assert.equal(by(rc.checkVersions(root))['versions agree'], rc.PASS)
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ version: '0.1.0', packages: { '': { version: '0.2.0' } } }))
  assert.equal(by(rc.checkVersions(root))['versions agree'], rc.FAIL)
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ version: '0.1.0', packages: { '': { version: '0.1.0' } } }))
  assert.equal(by(rc.checkVersions(root))['versions agree'], rc.FAIL)
})

test('markdown links: checked against tracked files, so missing, wrong-case and untracked targets fail', () => {
  const root = '/unused'
  const files: Record<string, string> = {
    'README.md': 'See [real](docs/real.md#top), [web](https://example.com/x), [anchor](#here), [mail](mailto:a@b.c), [dir](docs/), [root](/docs/real.md).',
    'docs/real.md': 'Back to [readme](../README.md) and [self](real.md?plain=1) and [spaced](my%20file.md "a title").',
    'docs/my file.md': '# spaced\n',
    'notes.txt': '[ignored](nowhere.md)',
  }
  assert.equal(rc.checkLinks(root, files).status, rc.PASS)
  const bad = (extra: Record<string, string>) => rc.checkLinks(root, { ...files, ...extra })
  assert.equal(bad({ 'docs/b.md': 'Bad [link](missing.md).' }).status, rc.FAIL)
  assert.ok(bad({ 'docs/b.md': 'Bad [link](missing.md).' }).detail.includes('docs/b.md: missing.md'))
  assert.equal(bad({ 'docs/b.md': 'Wrong case [x](REAL.md).' }).status, rc.FAIL)
  assert.equal(bad({ 'docs/b.md': 'Escapes the repo [x](../../outside.md).' }).status, rc.FAIL)
  assert.equal(bad({ 'docs/b.md': 'With a title [x](missing.md "t").' }).status, rc.FAIL)
  assert.equal(bad({ 'docs/b.md': 'Reference style.\n\n[ref]: missing.md\n' }).status, rc.FAIL)
  assert.equal(bad({ 'docs/b.md': 'Angle [x](<missing.md>).' }).status, rc.FAIL)
  assert.equal(bad({ 'docs/b.md': 'Example only: `[x](missing.md)` and\n```\n[y](missing.md)\n```\n' }).status, rc.PASS)
  assert.equal(rc.checkLinks(root, null).status, rc.SKIPPED)
})
