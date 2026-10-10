// Local release gate for jev-agent-kit. No dependencies; no network.
//
//   node scripts/release-check.ts            # development: everything that can run
//   node scripts/release-check.ts --release  # tagging: also requires clean main, a dated changelog,
//                                            # and treats any SKIPPED check as a failure
//
// Exit 0 only when no check FAILED (and, with --release, none SKIPPED). A check that cannot run
// reports SKIPPED, never PASS: a gate that cannot check must not look green.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const PASS = 'PASS'
export const FAIL = 'FAIL'
export const SKIPPED = 'SKIPPED'
export interface Result { name: string; status: string; detail: string }
const result = (name: string, status: string, detail = ''): Result => ({ name, status, detail })

const SECRET_PATTERNS: Record<string, RegExp> = {
  'openai-style key': /\bsk-[A-Za-z0-9_-]{16,}/,
  'github token': /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  'aws access key': /\bAKIA[A-Z0-9]{16}\b/,
  'private key block': /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  // Unquoted, quoted, and JSON-style assignments of a real-looking value.
  'assigned typesafe key': /TYPESAFE_API_KEY["']?\s*[:=]\s*["']?(?!REPLACE_ME\b)[^\s#"'$`,]{8,}/,
}
// Files that legitimately contain secret-shaped FAKE values (redaction tests and their fixtures).
// Trade-off: a real key committed under these paths would not be caught; the contract in CLAUDE.md
// is that tests use obvious fakes, and reviewers should treat any new value here with care.
const SCAN_EXEMPT_FILES = new Set(['scripts/release-check.ts', 'scripts/gen-golden.ts'])
const SCAN_EXEMPT_PREFIXES = ['tests/', 'cli/tests/']
const isExempt = (path: string) => SCAN_EXEMPT_FILES.has(path) || SCAN_EXEMPT_PREFIXES.some((p) => path.startsWith(p))

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const read = (root: string, ...parts: string[]) => readFileSync(join(root, ...parts), 'utf8')

export function tsVersion(root: string): string | null {
  return read(root, 'core', 'contracts.ts').match(/export const VERSION\s*=\s*'([^']+)'/)?.[1] ?? null
}

export function packageVersion(root: string): string | null {
  const value = readJson(join(root, 'package.json')).version
  return typeof value === 'string' ? value : null
}

// First `## <version> [(note)]` heading and its trailing note.
export function changelogHead(root: string): [string | null, string] {
  for (const line of read(root, 'CHANGELOG.md').split(/\r?\n/)) {
    const match = line.match(/^##\s+(\d+\.\d+\.\d+)\s*(?:\((.*)\))?\s*$/)
    if (match) return [match[1] ?? null, match[2] ?? '']
  }
  return [null, '']
}

export function checkVersions(root: string, release = false): Result[] {
  const [logVersion, note] = changelogHead(root)
  const found: Record<string, string | null | undefined> = {
    'core/contracts.ts': tsVersion(root),
    '.claude-plugin/plugin.json': readJson(join(root, '.claude-plugin', 'plugin.json')).version,
    'package.json': packageVersion(root),
    'CHANGELOG.md': logVersion,
  }
  if (existsSync(join(root, 'package-lock.json'))) {
    const lock = readJson(join(root, 'package-lock.json'))
    found['package-lock.json'] = lock.version === lock.packages?.['']?.version ? lock.version : `${lock.version}/${lock.packages?.['']?.version}`
  }
  const values = Object.values(found)
  const results: Result[] = []
  if (values.some((v) => v === null || v === undefined) || new Set(values).size !== 1) {
    results.push(result('versions agree', FAIL, Object.entries(found).map(([k, v]) => `${k}=${v}`).join(', ')))
  } else {
    results.push(result('versions agree', PASS, String(values[0])))
  }
  if (release) {
    results.push(note.toLowerCase().includes('unreleased')
      ? result('changelog dated for release', FAIL, `top entry still marked (${note})`)
      : result('changelog dated for release', PASS, note || 'no pre-release note'))
  }
  return results
}

export function checkManifests(root: string): Result[] {
  let plugin: any, market: any, hooks: any
  try {
    plugin = readJson(join(root, '.claude-plugin', 'plugin.json'))
    market = readJson(join(root, '.claude-plugin', 'marketplace.json'))
    hooks = readJson(join(root, 'hooks', 'hooks.json'))
  } catch (error) {
    return [result('manifests parse', FAIL, (error as Error).name)]
  }
  const problems: string[] = []
  if (plugin.defaultEnabled === false) problems.push('plugin.json sets defaultEnabled:false (a --plugin-dir load then registers no module)')
  if (!(market.plugins ?? []).some((p: any) => p.name === plugin.name)) problems.push('plugin name missing from marketplace.json')
  if (hooks.hooks && Object.keys(hooks.hooks).length) problems.push('hooks.json declares classic hooks again; the Mod owns Bash output and both would run')
  for (const module of hooks.modules ?? []) {
    if (!existsSync(join(root, 'hooks', module))) problems.push(`hooks module ${module} does not exist`)
  }
  return [result('manifests consistent', problems.length ? FAIL : PASS, problems.join('; '))]
}

// `files` maps relative path -> text. Names the path and pattern, never the match.
export function scanSecrets(files: Record<string, string>): Result {
  const hits: string[] = []
  for (const [path, text] of Object.entries(files)) {
    if (isExempt(path)) continue
    for (const [label, pattern] of Object.entries(SECRET_PATTERNS)) if (pattern.test(text)) hits.push(`${path}: ${label}`)
  }
  return result('no secrets in tracked files', hits.length ? FAIL : PASS, hits.join('; '))
}

export function trackedFiles(root: string): Record<string, string> | null {
  const done = spawnSync('git', ['ls-files', '-z'], { cwd: root })
  if (done.error || done.status !== 0) return null
  const files: Record<string, string> = {}
  for (const name of done.stdout.toString('utf8').split('\0').filter(Boolean)) {
    try {
      // Decode leniently: a secret in a latin-1 or binary-ish file must still be scanned.
      files[name] = readFileSync(join(root, name)).toString('utf8')
    } catch {
      // tracked but deleted from the working tree
    }
  }
  return files
}

export function checkGitState(root: string): Result[] {
  const git = (args: string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  const probe = git(['rev-parse', '--abbrev-ref', 'HEAD'])
  if (probe.error) return [result('clean main', SKIPPED, 'git not found')]
  const dirty = git(['status', '--porcelain']).stdout.trim()
  const problems: string[] = []
  const branch = probe.stdout.trim()
  if (branch !== 'main') problems.push(`on branch '${branch}', release from main`)
  if (dirty) problems.push('working tree has uncommitted changes')
  return [result('clean main', problems.length ? FAIL : PASS, problems.join('; '))]
}

export function runStep(name: string, argv: string[], root: string, missingReason: string): Result {
  const done = spawnSync(argv[0]!, argv.slice(1), { cwd: root, encoding: 'utf8' })
  if (done.error && (done.error as NodeJS.ErrnoException).code === 'ENOENT') return result(name, SKIPPED, missingReason)
  if (done.status === 0) return result(name, PASS)
  const tail = ((done.stdout ?? '') + (done.stderr ?? '')).trim().split(/\r?\n/).slice(-3)
  return result(name, FAIL, tail.join(' | '))
}

// Warnings we knowingly accept (the repo's own CLAUDE.md sits at the plugin root; it is guidance
// for contributors, not shipped context).
const ALLOWED_WARNINGS = ['CLAUDE.md at the plugin root']

export function summarizeValidation(report: any): Result {
  const problems: string[] = []
  for (const part of [report.manifest ?? {}, ...(report.contents ?? [])]) {
    for (const item of part.errors ?? []) problems.push('error: ' + String(item.message ?? JSON.stringify(item)))
    for (const item of part.warnings ?? []) {
      const message = String(item.message ?? JSON.stringify(item))
      if (!ALLOWED_WARNINGS.some((allowed) => message.startsWith(allowed))) problems.push('warning: ' + message)
    }
  }
  if (!report.success && !problems.length) problems.push('validate reported failure')
  return result('plugin validate', problems.length ? FAIL : PASS, problems.slice(0, 3).join(' | '))
}

export function runValidate(root: string): Result {
  const done = spawnSync('claude', ['plugin', 'validate', '--json', '.'], { cwd: root, encoding: 'utf8' })
  if (done.error) return result('plugin validate', SKIPPED, 'claude CLI not installed; manifest NOT validated')
  try {
    return summarizeValidation(JSON.parse(done.stdout))
  } catch {
    return result('plugin validate', FAIL, 'unparseable validate output')
  }
}

// `node --test` with no files, or with only skipped tests, exits 0: that must not look green.
export function nodeTests(root: string, specs: string[]): Result {
  if (!specs.length) return result('node tests', FAIL, 'no cli/tests/*.spec.ts files found')
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT // a nested run would otherwise report in a different format
  const done = spawnSync(process.execPath, ['--test', ...specs], { cwd: root, encoding: 'utf8', env })
  if (done.error) return result('node tests', SKIPPED, 'node unavailable')
  const out = (done.stdout ?? '') + (done.stderr ?? '')
  const count = (label: string) => Number(out.match(new RegExp('^# ' + label + ' (\\d+)', 'm'))?.[1] ?? NaN)
  if (done.status !== 0) return result('node tests', FAIL, out.trim().split(/\r?\n/).slice(-3).join(' | '))
  if (!(count('tests') > 0) || count('skipped') > 0 || count('todo') > 0) return result('node tests', FAIL, `ran ${count('tests')} tests, ${count('skipped')} skipped`)
  return result('node tests', PASS, `${count('pass')} passed`)
}

export function evaluate(results: Result[], release: boolean): number {
  const bad = release ? [FAIL, SKIPPED] : [FAIL]
  return results.some((r) => bad.includes(r.status)) ? 1 : 0
}

export function main(argv: string[], root = join(dirname(fileURLToPath(import.meta.url)), '..')): number {
  const release = argv.includes('--release')
  const results: Result[] = [...checkVersions(root, release), ...checkManifests(root)]
  const files = trackedFiles(root)
  results.push(files ? scanSecrets(files) : result('no secrets in tracked files', SKIPPED, 'git unavailable'))
  if (release) results.push(...checkGitState(root))
  const specs = existsSync(join(root, 'cli', 'tests')) ? readdirSync(join(root, 'cli', 'tests')).filter((n) => n.endsWith('.spec.ts')).sort().map((n) => join('cli', 'tests', n)) : []
  results.push(nodeTests(root, specs))
  results.push(runStep('mod tests (claude plugin test)', ['claude', 'plugin', 'test'], root, 'claude CLI not installed; mod tests NOT run'))
  results.push(runStep('golden fixture', [process.execPath, 'scripts/gen-golden.ts'], root, 'node unavailable'))
  const tsc = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')
  const generatedTypes = join(root, '.claude-plugin', 'types', 'claude-code', 'index.d.ts')
  results.push(existsSync(tsc)
    ? runStep('typecheck: cli, scripts, core', [tsc, '-p', 'tsconfig.node.json'], root, '')
    : result('typecheck: cli, scripts, core', SKIPPED, 'run npm ci (typescript is a dev dependency)'))
  results.push(existsSync(tsc) && existsSync(generatedTypes)
    ? runStep('typecheck: hooks, core, tests', [tsc, '-p', 'tsconfig.plugin.json'], root, '')
    : result('typecheck: hooks, core, tests', SKIPPED, 'needs typescript and .claude-plugin/types (Claude Code writes it when a mod loads interactively)'))
  results.push(runValidate(root))
  const width = Math.max(...results.map((r) => r.name.length))
  for (const r of results) console.log(`${r.status.padEnd(8)} ${r.name.padEnd(width)}  ${r.detail}`.trimEnd())
  const code = evaluate(results, release)
  console.log('\nRESULT:', code === 0 ? 'OK to proceed' : 'NOT OK: fix the lines above')
  return code
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) process.exitCode = main(process.argv.slice(2))
