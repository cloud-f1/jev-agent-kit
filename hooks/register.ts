// Jev Agent Kit: native Claude Code Mod. Thin adapter: all mods API calls live in this file,
// all decisions live in ../core (pure, testable without a session).
import { ENDPOINT, JevError, MAX_BYTES, MODEL, VERSION } from '../core/contracts.ts'
import type { Config, Transport } from '../core/contracts.ts'
import { mergeConfig, parseEnvFile, pluginKey, pluginModel } from '../core/config.ts'
import { digestString, sha256Hex } from '../core/hash.ts'
import { charLength, prune, redact } from '../core/prune.ts'

const DEFAULT_GOAL = 'Diagnose the current test or build failure'
const ARTIFACT_ID = /^[a-f0-9]{32}$/

// Session-local counters for the status line and loop observation. They reset on reload.
// Plugin settings from /config (userConfig), handed to register(on, options). Reset on reload.
let pluginOptions: unknown = {}
const stats = { seen: 0, pruned: 0, savedChars: 0 }
const fingerprints = new Map<string, number>()
// Reasons already shown as a toast this session, so a persistent problem is told once, not per command.
const toasted = new Set<string>()

// Same rule as the Python core: only "~" and "~/..." expand; a result that is not absolute is
// ignored, so state can never land in a relative path inside a repo.
// Windows sets OS=Windows_NT; everything else is treated as POSIX (macOS, Linux).
async function isWindows($: any): Promise<boolean> {
  return (await $.env.get('OS')) === 'Windows_NT'
}

const ABSOLUTE = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/ // /posix, C:\win or C:/win, \\unc

async function stateBase($: any): Promise<string> {
  const home = (await $.env.get('HOME')) || (await $.env.get('USERPROFILE')) || ''
  const fallback = home + '/.cache/jev-agent-kit'
  let dir: string | undefined = await $.env.get('JEV_STATE_DIR')
  if (!dir) return fallback
  if (dir === '~' || dir.startsWith('~/')) dir = home + dir.slice(1)
  return ABSOLUTE.test(dir) ? dir : fallback
}

// Python hashes Path(project).resolve(); the file API's realPath follows symlinks the same way on
// every platform (no `pwd -P`), so a symlinked cwd lands in the same project directory.
const resolved = new Map<string, string>()
async function physicalCwd($: any, cwd: string): Promise<string> {
  const known = resolved.get(cwd)
  if (known) return known
  let real = cwd
  try {
    const stat = await $.fs.stat(cwd, { resolve: true })
    if (typeof stat.realPath === 'string' && stat.realPath !== '') real = stat.realPath
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

// Raw logs may hold secrets. POSIX: umask 077 (files 0600, new directories 0700). Windows: the file
// API (directories are created for us); the default location is inside the user's profile, which
// Windows already restricts to that user. The Windows path has not been run on Windows yet.
async function writePrivate($: any, path: string, text: string): Promise<void> {
  if (await isWindows($)) {
    await $.fs.write(path, text)
    return
  }
  const run = await $.process.run(
    ['sh', '-c', 'umask 077; mkdir -p "$(dirname "$1")" && cat > "$1"', 'sh', path],
    { stdin: text, timeoutMs: 5000 },
  )
  if (run.exitCode !== 0) throw new Error('private_write_failed')
}

// defaults < plugin settings (/config) < project file. A bad project file throws; callers fail open.
async function loadEffective($: any, cwd: string) {
  const path = cwd + '/.claude/jev-agent-kit.json'
  const project = (await $.fs.exists(path)) ? JSON.parse(await $.fs.read(path)) : undefined
  return mergeConfig(pluginOptions, project)
}

async function loadConfig($: any, cwd: string): Promise<Config> {
  return (await loadEffective($, cwd)).config
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

// Claude Code's own settings.json `env` block, as a fallback (the same place other tools keep it).
async function settingsEnvKey($: any): Promise<string | undefined> {
  try {
    const env = (await $.settings.read())?.env
    const value = env && typeof env === 'object' ? (env as Record<string, unknown>)['TYPESAFE_API_KEY'] : undefined
    return typeof value === 'string' && value !== '' && value !== 'REPLACE_ME' ? value : undefined
  } catch {
    return undefined
  }
}

async function apiKey($: any): Promise<string | undefined> {
  const direct = await $.env.get('TYPESAFE_API_KEY')
  if (direct && direct !== 'REPLACE_ME') return direct
  const stored = pluginKey(pluginOptions)
  if (stored) return stored
  const fromSettings = await settingsEnvKey($)
  if (fromSettings) return fromSettings
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

// Tell the user once per reason per session. Only fixed reason codes are ever shown.
async function notifyOnce($: any, reason: string, message: string): Promise<void> {
  if (toasted.has(reason)) return
  toasted.add(reason)
  try {
    $.ui.toast('Jev Agent Kit: ' + message, { timeoutMs: 15000 })
  } catch {
    // A toast is a courtesy; never let it affect the tool result.
  }
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
  const lines = [`Jev Agent Kit ${VERSION} (native Mod), model ${MODEL}`]
  try {
    const { config: cfg, sources } = await loadEffective($, cwd)
    const show = (name: keyof Config) => `${name}=${cfg[name]} (${sources[name]})`
    lines.push('effective config: ' + (['enabled', 'mode', 'backend', 'minimumChars', 'keepThreshold', 'retentionDays'] as const).map(show).join(', '))
    if (!cfg.enabled) lines.push('This project is NOT opted in: add .claude/jev-agent-kit.json with "enabled": true, or turn on "Enable in every project" in /config.')
  } catch (error) {
    lines.push('config: INVALID (' + (error instanceof Error ? error.message : 'unknown') + '); output is left untouched')
  }
  const direct = await $.env.get('TYPESAFE_API_KEY')
  const where = direct ? 'environment' : pluginKey(pluginOptions) ? 'plugin settings (secure storage)' : (await settingsEnvKey($)) ? 'Claude Code settings.json env' : (await $.env.get('JEV_ENV_FILE')) ? 'JEV_ENV_FILE' : undefined
  lines.push('Jev model: ' + (pluginModel(pluginOptions) ?? MODEL) + (pluginModel(pluginOptions) ? ' (plugin settings)' : ' (default)'))
  lines.push('API key: ' + (where ? `present in ${where} (not validated)` : 'missing (only needed for the jev backend)'))
  lines.push('Change settings with /config (plugin options) or the project file.')
  return lines.join('\n')
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

export function register(on: any, options?: unknown) {
  pluginOptions = options ?? {}
  on('session.start', async ($: any, e: any, next: any) => {
    // Retention: raw logs may hold secrets, so enforce retentionDays (the classic hook does the same).
    try {
      const cwd = await $.session.cwd()
      const cfg = await loadConfig($, cwd)
      if (cfg.enabled) {
        const root = await projectRoot($, cwd)
        if (await isWindows($)) {
          // Arguments are passed as parameters, never spliced into the script text.
          await $.process.run(
            ['powershell', '-NoProfile', '-NonInteractive', '-Command',
              '& { param($p, $d) Get-ChildItem -LiteralPath $p -Recurse -File -ErrorAction SilentlyContinue | ' +
              'Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-[int]$d) } | Remove-Item -Force -ErrorAction SilentlyContinue }',
              root, String(cfg.retentionDays)],
            { timeoutMs: 20000 },
          )
        } else {
          await $.process.run(['find', root, '-type', 'f', '-mtime', '+' + cfg.retentionDays, '-delete'], { timeoutMs: 10000 })
        }
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
        model: pluginModel(pluginOptions), now: () => 0,
      })
      $.ui.log(
        `prune ${meta.reason}: ${meta.input_chars} -> ${meta.output_chars} chars (${meta.backend}, ${cfg.mode})`,
        { to: 'debug' },
      )
      if (meta.reason !== 'ok') {
        await notifyOnce($, meta.reason, `${meta.backend === 'jev' ? 'Jev unavailable' : 'could not prune'} (${meta.reason}); original output kept. /jev doctor shows settings.`)
      }
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
      await notifyOnce($, 'internal_error', 'internal error while pruning; original output kept. Run claude --debug to investigate.')
      return res
    }
  })
}
