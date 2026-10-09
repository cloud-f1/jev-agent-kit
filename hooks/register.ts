// Jev Agent Kit: native Claude Code Mod. Thin adapter: all mods API calls live in this file,
// all decisions live in ../core (pure, testable without a session).
import { ENDPOINT, JevError, MAX_BYTES, MODEL, VERSION } from '../core/contracts.ts'
import type { Config, Transport } from '../core/contracts.ts'
import { defaultConfig, parseEnvFile, validateConfig } from '../core/config.ts'
import { digestString, sha256Hex } from '../core/hash.ts'
import { charLength, prune, redact } from '../core/prune.ts'

const DEFAULT_GOAL = 'Diagnose the current test or build failure'
const ARTIFACT_ID = /^[a-f0-9]{32}$/

// Session-local counters for the status line and loop observation. They reset on reload.
const stats = { seen: 0, pruned: 0, savedChars: 0 }
const fingerprints = new Map<string, number>()

// Same rule as the Python core: only "~" and "~/..." expand; a result that is not absolute is
// ignored, so state can never land in a relative path inside a repo.
async function stateBase($: any): Promise<string> {
  const home = (await $.env.get('HOME')) ?? ''
  const fallback = home + '/.cache/jev-agent-kit'
  let dir: string | undefined = await $.env.get('JEV_STATE_DIR')
  if (!dir) return fallback
  if (dir === '~' || dir.startsWith('~/')) dir = home + dir.slice(1)
  return dir.startsWith('/') ? dir : fallback
}

// Python hashes Path(project).resolve(); `pwd -P` is the physical path, so symlinked cwds agree.
const resolved = new Map<string, string>()
async function physicalCwd($: any, cwd: string): Promise<string> {
  const known = resolved.get(cwd)
  if (known) return known
  let real = cwd
  try {
    const run = await $.process.run(['pwd', '-P'], { cwd, timeoutMs: 2000 })
    if (run.exitCode === 0 && run.stdout.trim().startsWith('/')) real = run.stdout.trim()
  } catch {
    // Fall back to the reported cwd.
  }
  resolved.set(cwd, real)
  return real
}

// Same layout as the Python core: <base>/<sha256("<resolved cwd>")[:24]>/{artifacts,decisions}
async function projectRoot($: any, cwd: string): Promise<string> {
  return (await stateBase($)) + '/' + (await digestString(await physicalCwd($, cwd))).slice(0, 24)
}

// Raw logs may hold secrets: write with umask 077 (files 0600, new directories 0700).
async function writePrivate($: any, path: string, text: string): Promise<void> {
  const run = await $.process.run(
    ['sh', '-c', 'umask 077; mkdir -p "$(dirname "$1")" && cat > "$1"', 'sh', path],
    { stdin: text, timeoutMs: 5000 },
  )
  if (run.exitCode !== 0) throw new Error('private_write_failed')
}

async function loadConfig($: any, cwd: string): Promise<Config> {
  const path = cwd + '/.claude/jev-agent-kit.json'
  if (!(await $.fs.exists(path))) return defaultConfig()
  return validateConfig(JSON.parse(await $.fs.read(path)))
}

async function loadGoal($: any, cwd: string): Promise<string> {
  const path = cwd + '/.claude/jev-goal.txt'
  try {
    if (await $.fs.exists(path)) return redact((await $.fs.read(path)).slice(0, 1200))
  } catch {
    // An unreadable goal file falls back to the default goal.
  }
  return DEFAULT_GOAL
}

async function apiKey($: any): Promise<string | undefined> {
  const direct = await $.env.get('TYPESAFE_API_KEY')
  if (direct && direct !== 'REPLACE_ME') return direct
  const file = await $.env.get('JEV_ENV_FILE')
  if (!file) return undefined
  try {
    return parseEnvFile(await $.fs.read(file))
  } catch {
    return undefined
  }
}

// The only network path. Fixed endpoint; the key never leaves this function; failures are
// reduced to fixed reason codes so no response body or exception text is ever recorded.
function makeTransport($: any, key: string | undefined, timeoutMs: number): Transport {
  return async (body) => {
    if (!key) throw new JevError('missing_key')
    const encoded = JSON.stringify(body)
    if (new TextEncoder().encode(encoded).length > MAX_BYTES) throw new JevError('request_too_large')
    const deadline = $.clock.sleep(timeoutMs).then(() => {
      throw new JevError('timeout')
    })
    deadline.catch(() => {})
    let response: { ok: boolean; status: number; text: string }
    try {
      response = await Promise.race([
        $.http.fetch(ENDPOINT, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
          body: encoded,
        }),
        deadline,
      ])
    } catch (error) {
      throw error instanceof JevError ? error : new JevError('transport_or_json_error')
    }
    if (!response.ok) throw new JevError('http_' + response.status)
    if (new TextEncoder().encode(response.text).length > MAX_BYTES) throw new JevError('response_too_large')
    try {
      return JSON.parse(response.text)
    } catch {
      throw new JevError('transport_or_json_error')
    }
  }
}

async function recordDecision($: any, root: string, entry: Record<string, unknown>): Promise<void> {
  const ms = await $.clock.now()
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('')
  const name = (BigInt(ms) * 1_000_000n).toString() + '-' + suffix + '.json'
  await writePrivate($, root + '/decisions/' + name, JSON.stringify({ ...entry, timestamp: ms / 1000 }))
}

async function repoState($: any, cwd: string): Promise<string> {
  try {
    const head = await $.process.run(['git', 'rev-parse', 'HEAD'], { cwd, timeoutMs: 1000 })
    const diff = await $.process.run(['git', 'diff', 'HEAD', '--'], { cwd, timeoutMs: 1000 })
    if (head.exitCode !== 0 || diff.exitCode !== 0) return 'unknown' // not a repo / no commits
    return await sha256Hex(head.stdout + '\u0000' + diff.stdout)
  } catch {
    return 'unknown'
  }
}

async function observeLoop($: any, root: string, cwd: string, cfg: Config, command: string, output: string): Promise<void> {
  const state = await repoState($, cwd)
  const fingerprint = await digestString(JSON.stringify([command, output, state]))
  const count = (fingerprints.get(fingerprint) ?? 0) + 1
  fingerprints.set(fingerprint, count)
  await recordDecision($, root, {
    feature: 'loop', repeated_count: count, action: 'observe',
    repo_state_known: state !== 'unknown', mode: cfg.mode,
  })
}

async function showStatus($: any, cfg: Config): Promise<void> {
  const text = cfg.mode === 'assist'
    ? `jev: ${stats.pruned}/${stats.seen} long logs pruned · ${stats.savedChars} chars saved`
    : `jev (observe): ${stats.seen} long logs seen, none rewritten`
  await $.ui.status(text)
}

async function statusText($: any): Promise<string> {
  const root = await projectRoot($, await $.session.cwd())
  let names: string[] = []
  try {
    names = (await $.fs.list(root + '/decisions')).map((entry: { name: string }) => entry.name).sort()
  } catch {
    // No decisions directory yet.
  }
  const lines: string[] = []
  for (const name of names.slice(-10)) {
    try {
      const row = JSON.parse(await $.fs.read(root + '/decisions/' + name))
      lines.push(`${row.feature ?? 'prune'} · ${row.reason ?? row.action ?? ''} · ${row.input_chars ?? ''} → ${row.output_chars ?? ''} chars`)
    } catch {
      lines.push('(unreadable record ' + name + ')')
    }
  }
  return `Jev Agent Kit ${VERSION}: ${names.length} records for this project\n` + (lines.join('\n') || '(none yet)')
}

async function doctorText($: any): Promise<string> {
  const cwd = await $.session.cwd()
  let config = 'config: default (disabled; no .claude/jev-agent-kit.json)'
  try {
    const cfg = await loadConfig($, cwd)
    config = `config: enabled=${cfg.enabled} mode=${cfg.mode} backend=${cfg.backend} minimumChars=${cfg.minimumChars}`
  } catch (error) {
    config = 'config: INVALID (' + (error instanceof Error ? error.message : 'unknown') + ')'
  }
  const key = (await apiKey($)) ? 'present (not validated)' : 'missing'
  return [`Jev Agent Kit ${VERSION} (native Mod), model ${MODEL}`, config, 'TYPESAFE_API_KEY: ' + key].join('\n')
}

async function readbackText($: any, id: string): Promise<string> {
  if (!ARTIFACT_ID.test(id)) return 'Usage: /jev readback <32-hex artifact id>'
  const root = await projectRoot($, await $.session.cwd())
  try {
    return await $.fs.read(root + '/artifacts/' + id + '.log')
  } catch {
    return 'No artifact ' + id + ' for this project.'
  }
}

export function register(on: any) {
  on('session.start', async ($: any, e: any, next: any) => {
    // The marker tells the classic Python hook to skip this session so nothing runs twice.
    try {
      const marker = (await digestString(await $.session.id())).slice(0, 24)
      await writePrivate($, (await stateBase($)) + '/mod-active/' + marker, VERSION)
    } catch {
      // Without a marker the classic hook may also run; that is a cost, not a safety issue.
    }
    // Retention: raw logs may hold secrets, so enforce retentionDays (the classic hook does the same).
    try {
      const cwd = await $.session.cwd()
      const cfg = await loadConfig($, cwd)
      if (cfg.enabled) {
        const root = await projectRoot($, cwd)
        await $.process.run(['find', root, '-type', 'f', '-mtime', '+' + cfg.retentionDays, '-delete'], { timeoutMs: 10000 })
        await $.process.run(['find', (await stateBase($)) + '/mod-active', '-type', 'f', '-mtime', '+30', '-delete'], { timeoutMs: 10000 })
      }
    } catch {
      // No config or nothing to clean yet.
    }
    try {
      await $.command.register({ name: 'jev', description: 'Jev Agent Kit: status | doctor | readback <id>', argumentHint: 'status|doctor|readback <id>' })
    } catch {
      // A taken command name must not stop the session from starting.
    }
    return next(e)
  })

  on('command.run', { command: 'jev' }, async ($: any, e: any) => {
    const [sub, arg] = String(e.args ?? '').trim().split(/\s+/)
    if (sub === 'status') return { text: await statusText($) }
    if (sub === 'doctor') return { text: await doctorText($) }
    if (sub === 'readback') return { text: await readbackText($, arg ?? '') }
    return { text: 'Usage: /jev status | doctor | readback <artifact id>' }
  })

  on('tool.call', { tool: 'Bash' }, async ($: any, e: any, next: any) => {
    const res = await next(e)
    // From here on any failure returns the untouched original result.
    try {
      if (res.deny !== undefined || res.result === undefined) return res
      const cwd = await $.session.cwd()
      const cfg = await loadConfig($, cwd)
      if (!cfg.enabled) return res
      const root = await projectRoot($, cwd)
      if (res.isError) {
        await observeLoop($, root, cwd, cfg, String(e.command ?? ''), String(res.text ?? ''))
        return res
      }
      const out = res.result as { stdout?: unknown; interrupted?: unknown; isImage?: unknown; stderr?: unknown }
      if (typeof out.stdout !== 'string') {
        await recordDecision($, root, { feature: 'compatibility', reason: 'unknown_tool_shape' })
        return res
      }
      await observeLoop($, root, cwd, cfg, String(e.command ?? ''), out.stdout)
      if (charLength(out.stdout) < cfg.minimumChars) return res

      stats.seen += 1
      const artifactId = (await sha256Hex(JSON.stringify(out.stdout))).slice(0, 32)
      await writePrivate($, root + '/artifacts/' + artifactId + '.log', out.stdout)
      const transport = cfg.backend === 'jev' ? makeTransport($, await apiKey($), cfg.timeoutSeconds * 1000) : undefined
      const { output, meta } = await prune(out.stdout, {
        backend: cfg.backend, goal: await loadGoal($, cwd), threshold: cfg.keepThreshold, transport,
        now: () => 0,
      })
      const fieldsOk = 'stderr' in out && 'interrupted' in out && 'isImage' in out
      // Never change failed/interrupted/image tool results or erase stderr.
      const canRewrite = cfg.mode === 'assist' && output !== out.stdout && fieldsOk && !out.interrupted && !out.isImage
      const stdout = canRewrite ? output + '\n[Jev agent kit: full original available via /jev readback ' + artifactId + ']\n' : out.stdout
      if (cfg.mode === 'assist' && output !== out.stdout && !fieldsOk) {
        await recordDecision($, root, { feature: 'compatibility', reason: 'missing_tool_fields' })
      }
      await recordDecision($, root, {
        ...meta, mode: cfg.mode, artifact_id: artifactId, delivered_chars: charLength(stdout),
      })
      if (canRewrite) {
        stats.pruned += 1
        stats.savedChars += charLength(out.stdout) - charLength(stdout)
        await showStatus($, cfg)
        // A fresh { result } (no ref/text) so core re-validates and re-maps it for the model.
        return res.context === undefined
          ? { result: { ...out, stdout } }
          : { result: { ...out, stdout }, context: res.context }
      }
      await showStatus($, cfg)
      return res
    } catch {
      return res
    }
  })
}
