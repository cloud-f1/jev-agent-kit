// Golden fixtures: tests/fixtures/golden.ts was generated from the former Python reference core and
// is the frozen contract for the pure core (pruning, redaction, hashing, settings merge).
//
//   node scripts/gen-golden.ts           # check: build() must equal the checked-in fixture (exit 1 if not)
//   node scripts/gen-golden.ts --write   # regenerate from the TypeScript core after an INTENTIONAL
//                                        # behavior change; review the diff like any other code change
//
// Secret-shaped strings below are fake redaction-test inputs.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mergeConfig } from '../core/config.ts'
import { digestString } from '../core/hash.ts'
import { prune, redact } from '../core/prune.ts'

const filler = (n: number) => Array.from({ length: n }, (_, i) => `filler ${i}\n`)
const warn = (n: number, tag = 'deprecated api') => Array.from({ length: n }, (_, i) => `WARNING: ${tag} call #${i} at step ${i * 7}\n`)

export async function build() {
  const cases: Array<Record<string, unknown>> = []
  const add = async (name: string, text: string) => {
    const { output, meta } = await prune(text, { backend: 'rules', goal: '', threshold: 0.8 })
    cases.push({ name, input: text, expected_output: output, expected_input_chars: meta.input_chars, expected_reason: meta.reason })
  }
  const lines = Array.from({ length: 320 }, (_, i) => `progress item ${i}\n`)
  lines[141] = 'ERROR build: expected contract 1, got invalid\n'
  await add('long-with-error', lines.join(''))
  await add('crlf-and-unicode',
    Array.from({ length: 100 }, (_, i) => `步驟 ${i} ok\r\n`).join('') +
    'Traceback (most recent call last):\r\n  File "x.py", line 1\r\nValueError: 壞了\r\n' +
    Array.from({ length: 100 }, (_, i) => `步驟 ${i + 100} ok\r\n`).join(''))
  await add('separators', 'a\x0bb\x0cc\x1cd\x85e\u2028f\u2029g\n'.repeat(40))
  await add('no-trailing-newline', Array.from({ length: 80 }, (_, i) => `line ${i}\n`).join('') + 'last line without newline FAIL')
  await add('all-important', Array.from({ length: 50 }, (_, i) => `error ${i}\n`).join(''))
  for (const [name, special] of [['cr-in-at-line', 'at foo\rbar:12\n'], ['unicode-digit', 'at foo:٣\n'], ['dotless-i', 'FAıL\n'],
    ['x1f-file', '\x1f File x\n'], ['unicode-word-boundary', 'warné x\n'], ['emoji-lines', '\u{1F600} emoji line ERROR\n']]) {
    await add(name, filler(40).join('') + special + filler(40).join(''))
  }
  await add('repeated-warnings', filler(30).join('') + warn(200).join('') + filler(30).join(''))
  await add('warnings-below-threshold', filler(30).join('') + warn(5).join('') + filler(30).join(''))
  await add('warnings-with-error-never-collapsed', filler(30).join('') + warn(100, 'warn error code').join('') + filler(30).join(''))
  await add('warning-runs-broken-by-error', filler(30).join('') + warn(10).join('') + 'ERROR boom\n' + warn(10).join('') + filler(30).join(''))
  await add('warning-run-no-trailing-newline', filler(30).join('') + warn(9).join('').slice(0, -1))
  await add('emoji-bulk', Array.from({ length: 120 }, (_, i) => `\u{1F600} line ${i}\n`).join(''))
  const redactions = [
    'Authorization: Bearer abcdefSECRET123',
    '{"api_key": "SECRETJSON123", "password":"PW99"}',
    'password: "quoted secret"',
    "token='single quoted value' next",
    'curl -H "Authorization: Basic dXNlcjpwYXNz1234" url',
    'sk-abcdefghijklmnop and ghp_abcdefghijklmnop and AKIAABCDEFGHIJKLMNOP',
    'plain text with no secrets: tokenizer is fine',
  ].map((input) => ({ input, expected: redact(input) }))
  const mergeInputs: Array<[Record<string, unknown>, Record<string, unknown> | null]> = [
    [{}, null], [{ mode: 'assist' }, null], [{ enable_all_projects: true }, null],
    [{ mode: 'assist', backend: 'jev' }, { mode: 'observe' }],
    [{ mode: 'bogus', minimum_chars: 5000 }, null], [{ minimum_chars: 999999999 }, null],
    [{ keep_threshold: 0.5, retention_days: 14 }, { enabled: true }],
    [{ enable_all_projects: true }, { enabled: false }], [{}, { endpoint: 'https://evil.example' }],
    [{ retention_days: 0 }, { minimumChars: 100 }],
  ]
  const merges = mergeInputs.map(([options, project]) => {
    let expected: unknown
    try {
      expected = mergeConfig(options, project ?? undefined).config
    } catch (error) {
      expected = { error: (error as Error).message }
    }
    return { options, project, expected }
  })
  const digests: Record<string, string> = {}
  for (const v of ['session-golden', '/work/project', '/tmp/données 日本語"quote']) digests[v] = (await digestString(v)).slice(0, 24)
  return { merges, redactions, digests, cases }
}

const here = fileURLToPath(import.meta.url)
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const fixture = fileURLToPath(new URL('../tests/fixtures/golden.ts', import.meta.url))
  const built = await build()
  if (process.argv.includes('--write')) {
    writeFileSync(fixture, '// Generated by scripts/gen-golden.ts (originally from the Python reference core). Do not edit by hand.\nexport default ' + JSON.stringify(built, null, 1) + '\n', 'utf8')
    console.log('wrote tests/fixtures/golden.ts')
  } else {
    const current = (await import(pathToFileURL(fixture).href)).default
    const same = JSON.stringify(current) === JSON.stringify(built)
    console.log(same ? 'golden fixture matches the TypeScript core' : 'GOLDEN MISMATCH: behavior changed; review, then run with --write')
    process.exitCode = same ? 0 : 1
  }
  void here
}
