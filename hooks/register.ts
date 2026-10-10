// Jev Agent Kit: native Claude Code Mod. Thin adapter: all mods API calls live in this file,
// all decisions live in ../core (pure, testable without a session).
import { ENDPOINT, JevError, MAX_BYTES, MODEL, VERSION } from '../core/contracts.ts'
import type { Config, Transport } from '../core/contracts.ts'
import type { EngineInterface as Engine, On, PluginOptions, RenderElement } from 'claude-code' // types only; erased at run time
import { mergeConfig, parseEnvFile, pluginKey, pluginModel } from '../core/config.ts'
import { digestString, sha256Hex } from '../core/hash.ts'
import { charLength, jevNotAsked, prune, redact } from '../core/prune.ts'

const DEFAULT_GOAL = 'Diagnose the current test or build failure'
const ARTIFACT_ID = /^[a-f0-9]{32}$/

// Session-local counters for the status line and loop observation. They reset on reload.
// Plugin settings from /config (userConfig), handed to register(on, options). Reset on reload.
let pluginOptions: unknown = {}
const stats = { seen: 0, pruned: 0, savedChars: 0, readbacks: 0 }
const PANE_ID = 'jev-pane'
const paneCache: { at: number; root: string; lines: string[] } = { at: -Infinity, root: '', lines: [] } // a drawing can repeat often: reread records at most every 3 s
const pausedRoots = new Set<string>() // projects where a read-back happened this session
const fingerprints = new Map<string, number>()
// Reasons already shown as a toast this session, so a persistent problem is told once, not per command.
const toasted = new Set<string>()

// Same rule as the CLI (cli/io.ts): only "~" and "~/..." expand; a result that is not absolute is
// ignored, so state can never land in a relative path inside a repo.
// Windows sets OS=Windows_NT; everything else is treated as POSIX (macOS, Linux).
async function isWindows($: Engine): Promise<boolean> {
  return (await $.env.get('OS')) === 'Windows_NT'
}

const ABSOLUTE = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/ // /posix, C:\win or C:/win, \\unc

async function stateBase($: Engine): Promise<string> {
  const home = (await $.env.get('HOME')) || (await $.env.get('USERPROFILE')) || ''
  const fallback = home + '/.cache/jev-agent-kit'
  let dir: string | undefined = await $.env.get('JEV_STATE_DIR')
  if (!dir) return fallback
  if (dir === '~' || dir.startsWith('~/')) dir = home + dir.slice(1)
  return ABSOLUTE.test(dir) ? dir : fallback
}

// The CLI hashes the resolved project path; the file API's realPath follows symlinks the same way on
// every platform (no `pwd -P`), so a symlinked cwd lands in the same project directory.
const resolved = new Map<string, string>()
async function physicalCwd($: Engine, cwd: string): Promise<string> {
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

// Same layout as the CLI: <base>/<sha256("<resolved cwd>")[:24]>/{artifacts,decisions}
async function projectRoot($: Engine, cwd: string): Promise<string> {
  return (await stateBase($)) + '/' + (await digestString(await physicalCwd($, cwd))).slice(0, 24)
}

// Raw logs may hold secrets. POSIX: umask 077 (files 0600, new directories 0700). Windows: the file
// API (directories are created for us); the default location is inside the user's profile, which
// Windows already restricts to that user. The Windows path has not been run on Windows yet.
async function writePrivate($: Engine, path: string, text: string): Promise<void> {
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
async function loadEffective($: Engine, cwd: string) {
  const path = cwd + '/.claude/jev-agent-kit.json'
  const project = (await $.fs.exists(path)) ? JSON.parse(await $.fs.read(path)) : undefined
  return mergeConfig(pluginOptions, project)
}

async function loadConfig($: Engine, cwd: string): Promise<Config> {
  return (await loadEffective($, cwd)).config
}

async function loadGoal($: Engine, cwd: string): Promise<string> {
  const path = cwd + '/.claude/jev-goal.txt'
  try {
    if (await $.fs.exists(path)) return redact((await $.fs.read(path)).slice(0, 1200))
  } catch {
    // An unreadable goal file falls back to the default goal.
  }
  return DEFAULT_GOAL
}

// Claude Code's own settings.json `env` block, as a fallback (the same place other tools keep it).
// User settings only: the unfiltered merge would also take a key from a cloned repo's
// .claude/settings.json, and projects must never supply a key.
async function settingsEnvKey($: Engine): Promise<string | undefined> {
  try {
    const env = (await $.settings.read({ source: 'user' }))?.env
    const value = env && typeof env === 'object' ? (env as Record<string, unknown>)['TYPESAFE_API_KEY'] : undefined
    return typeof value === 'string' && value !== '' && value !== 'REPLACE_ME' ? value : undefined
  } catch {
    return undefined
  }
}

async function apiKey($: Engine): Promise<string | undefined> {
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
function makeTransport($: Engine, key: string | undefined, timeoutMs: number): Transport {
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

async function recordDecision($: Engine, root: string, entry: Record<string, unknown>): Promise<void> {
  const ms = await $.clock.now()
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('')
  const name = (BigInt(ms) * 1_000_000n).toString() + '-' + suffix + '.json'
  await writePrivate($, root + '/decisions/' + name, JSON.stringify({ ...entry, timestamp: ms / 1000 }))
}

async function repoState($: Engine, cwd: string): Promise<string> {
  try {
    const head = await $.process.run(['git', 'rev-parse', 'HEAD'], { cwd, timeoutMs: 1000 })
    const diff = await $.process.run(['git', 'diff', 'HEAD', '--'], { cwd, timeoutMs: 1000 })
    if (head.exitCode !== 0 || diff.exitCode !== 0) return 'unknown' // not a repo / no commits
    return await sha256Hex(head.stdout + '\u0000' + diff.stdout)
  } catch {
    return 'unknown'
  }
}

async function observeLoop($: Engine, root: string, cwd: string, cfg: Config, command: string, output: string): Promise<void> {
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
async function notifyOnce($: Engine, reason: string, message: string): Promise<void> {
  if (toasted.has(reason)) return
  toasted.add(reason)
  try {
    $.ui.toast('Jev Agent Kit: ' + message, { timeoutMs: 15000 })
  } catch {
    // A toast is a courtesy; never let it affect the tool result.
  }
}

async function showStatus($: Engine, cfg: Config): Promise<void> {
  const text = cfg.mode === 'assist'
    ? `jev: ${stats.pruned}/${stats.seen} long logs pruned · ${stats.savedChars} chars saved${stats.readbacks > 0 ? ' · paused after read-back' : ''}`
    : `jev (observe): ${stats.seen} long logs seen, none rewritten`
  await $.ui.status(text)
}

async function statusText($: Engine): Promise<string> {
  const root = await projectRoot($, await $.session.cwd())
  let names: string[] = []
  try {
    names = (await $.fs.list(root + '/decisions')).map((entry: { name: string }) => entry.name).sort()
  } catch {
    // No decisions directory yet.
  }
  const lines: string[] = []
  let loops = 0
  let highestRepeat = 0
  for (const name of names.slice(-200)) {
    try {
      const row = JSON.parse(await $.fs.read(root + '/decisions/' + name))
      if (row.feature === 'loop') {
        // Failed-command repeat records carry a count, not character counts: summarize them on one line.
        loops += 1
        if (typeof row.repeated_count === 'number' && Number.isFinite(row.repeated_count)) highestRepeat = Math.max(highestRepeat, row.repeated_count)
        continue
      }
      const counts = typeof row.input_chars === 'number' && typeof row.output_chars === 'number' ? ` · ${row.input_chars} → ${row.output_chars} chars`
        : typeof row.input_chars === 'number' ? ` · ${row.input_chars} chars in` : ''
      // backend jev but no request sent: every block was an error/warning line, kept by the local rules.
      const note = jevNotAsked(row) ? ' · Jev not asked (every block was an error/warning line; local rules only)' : ''
      lines.push(`${row.feature ?? 'prune'} · ${row.reason ?? row.action ?? 'recorded'}${counts}${note}`)
    } catch {
      lines.push('(unreadable record ' + name + ')')
    }
  }
  const shown = lines.slice(-10)
  if (loops > 0) shown.push(`failed-command repeats: ${loops} records among the last 200, highest repeat count ${highestRepeat} (recorded only, output unchanged)`)
  return `Jev Agent Kit ${VERSION}: ${names.length} records for this project\n` + (shown.join('\n') || '(none yet)')
}

async function doctorText($: Engine): Promise<string> {
  const cwd = await $.session.cwd()
  const lines = [`Jev Agent Kit ${VERSION} (native Mod), model ${MODEL}`]
  try {
    const { config: cfg, sources } = await loadEffective($, cwd)
    const show = (name: keyof Config) => `${name}=${cfg[name]} (${sources[name]})`
    lines.push('effective config: ' + (['enabled', 'mode', 'backend', 'minimumChars', 'keepThreshold', 'retentionDays'] as const).map(show).join(', '))
    if (!cfg.enabled) lines.push('This project is NOT opted in: add .claude/jev-agent-kit.json with "enabled": true, or turn on "Enable in every project" in /plugin → Installed → Jev Agent Kit → Configure.')
  } catch (error) {
    lines.push('config: INVALID (' + (error instanceof Error ? error.message : 'unknown') + '); output is left untouched')
  }
  const direct = await $.env.get('TYPESAFE_API_KEY')
  const where = direct ? 'environment' : pluginKey(pluginOptions) ? 'plugin settings (secure storage)' : (await settingsEnvKey($)) ? 'Claude Code settings.json env' : (await $.env.get('JEV_ENV_FILE')) ? 'JEV_ENV_FILE' : undefined
  lines.push('Jev model: ' + (pluginModel(pluginOptions) ?? MODEL) + (pluginModel(pluginOptions) ? ' (plugin settings)' : ' (default)'))
  lines.push('API key: ' + (where ? `present in ${where} (not validated)` : 'missing (only needed for the jev backend)'))
  lines.push('Change settings in /plugin → Installed → Jev Agent Kit → Configure (or: claude plugin configure jev-agent-kit) or in the project file.')
  lines.push('Updates: Claude Code does them. Auto-update is off by default for third-party marketplaces: /plugin → Marketplaces → jev-agent-kit → Enable auto-update, or run: claude plugin update jev-agent-kit@jev-agent-kit (then /reload-plugins or restart).')
  return lines.join('\n')
}

// Changes one /config row as if the person did it in the menu. Row keys are `<plugin>.<field>`.
// Only a fixed set of non-secret fields is ever written here; the reply never echoes input.
async function setOption($: Engine, field: 'mode' | 'enable_all_projects', value: string | boolean): Promise<string> {
  try {
    const res = await $.config.set({ key: 'jev-agent-kit.' + field, value })
    if (res?.deny !== undefined) return 'Not changed: Claude Code refused it (a locked or managed setting). Use /plugin → Installed → Jev Agent Kit → Configure.'
    const scope = field === 'enable_all_projects' && value === true ? 'Pruning is now ON for ALL projects without their own project file. ' : ''
    return scope + 'Set ' + field + ' = ' + String(value) + ' (your plugin settings, every project). /jev doctor shows the effective values; a project file still overrides.'
  } catch {
    // Seen live (headless claude -p): Claude Code exposes no /config row for this plugin there.
    return 'Could not change the setting from here (Claude Code refused or has no matching /config row; headless runs have none). Use /plugin → Installed → Jev Agent Kit → Configure, or: claude plugin configure jev-agent-kit'
  }
}

const PRESETS: Record<string, { mode: 'observe' | 'assist'; backend: 'rules' | 'jev'; about: string }> = {
  'observe-local': { mode: 'observe', backend: 'rules', about: 'record only, nothing leaves the machine' },
  'shadow-jev': { mode: 'observe', backend: 'jev', about: 'ask Jev and record, never rewrite (sends redacted blocks to the API)' },
  'prune-local': { mode: 'assist', backend: 'rules', about: 'rewrite long output with the local rules' },
  'prune-jev': { mode: 'assist', backend: 'jev', about: 'rewrite using Jev relevance (needs a key; falls back to the original)' },
}

// Reads the project file back and reports only the three fixed fields, and only known values.
async function projectFileSummary($: Engine, path: string): Promise<string> {
  try {
    const raw = JSON.parse(await $.fs.read(path))
    const pick = (field: string, allowed: string[]) => (typeof raw?.[field] === 'string' && allowed.includes(raw[field]) ? String(raw[field]) : '?')
    const enabled = typeof raw?.enabled === 'boolean' ? String(raw.enabled) : '?'
    return `enabled=${enabled}, mode=${pick('mode', ['observe', 'assist'])}, backend=${pick('backend', ['rules', 'jev'])}`
  } catch {
    return 'unreadable'
  }
}

// Creates the project opt-in file with fixed fields only; never overwrites one that exists.
async function writeProject($: Engine, mode: 'observe' | 'assist', backend: 'rules' | 'jev'): Promise<string> {
  try {
    const path = (await $.session.cwd()) + '/.claude/jev-agent-kit.json'
    if (await $.fs.exists(path)) {
      return 'Project file already exists; not changed (it says ' + (await projectFileSummary($, path)) + '). To switch, edit "mode" or "backend" in .claude/jev-agent-kit.json, or delete the file and run /jev preset <name>. /jev doctor shows the effective values.'
    }
    await $.fs.write(path, JSON.stringify({ schemaVersion: 1, enabled: true, mode, backend }, null, 2) + '\n')
    const sends = backend === 'jev' ? ' backend=jev sends redacted log blocks to api.typesafe.ai (needs an API key).' : ' Nothing leaves this machine (backend=rules).'
    return 'Created .claude/jev-agent-kit.json. Read back: ' + (await projectFileSummary($, path)) + '.' + sends + ' Takes effect on the next Bash call. /jev doctor shows the effective values.'
  } catch {
    return 'Could not create the project file. Create .claude/jev-agent-kit.json by hand (see README).'
  }
}

async function initProject($: Engine, mode: string): Promise<string> {
  if (mode !== 'observe' && mode !== 'assist') return 'Usage: /jev init [observe|assist]'
  return writeProject($, mode, 'rules')
}

async function presetProject($: Engine, name: string | undefined): Promise<string> {
  const preset = name !== undefined && Object.hasOwn(PRESETS, name) ? PRESETS[name] : undefined
  if (!preset) {
    return 'Usage: /jev preset <name>, creates the project file. Presets:\n' +
      Object.entries(PRESETS).map(([key, value]) => `  ${key}: ${value.about}`).join('\n')
  }
  return writeProject($, preset.mode, preset.backend)
}

// What assist would have saved (observe) or did save (assist), from this project's records.
// Counted characters only: this is not a token, cost or success claim.
async function savingsText($: Engine, limit = 500): Promise<string> {
  const root = await projectRoot($, await $.session.cwd())
  let names: string[] = []
  try {
    names = (await $.fs.list(root + '/decisions')).map((entry: { name: string }) => entry.name).sort().slice(-limit)
  } catch {
    // No decisions directory yet.
  }
  const total = { observe: { logs: 0, chars: 0 }, assist: { logs: 0, chars: 0 }, fellBack: 0, jevAsked: 0, jevNotAsked: 0 }
  const count = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
  for (const name of names) {
    try {
      const row = JSON.parse(await $.fs.read(root + '/decisions/' + name))
      if (typeof row.artifact_id !== 'string' || !count(row.input_chars)) continue
      if (row.reason !== 'ok') { total.fellBack += 1; continue }
      if (row.backend === 'jev') total[jevNotAsked(row) ? 'jevNotAsked' : 'jevAsked'] += 1
      if (row.mode === 'assist' && count(row.delivered_chars)) {
        if (row.delivered_chars !== row.input_chars) {
          total.assist.logs += 1 // only rows that were actually rewritten
          total.assist.chars += row.input_chars - row.delivered_chars // net, includes the receipt line; may be negative
        }
      } else if (count(row.output_chars)) {
        total.observe.logs += 1
        total.observe.chars += Math.max(0, row.input_chars - row.output_chars)
      }
    } catch {
      // Unreadable record: skip.
    }
  }
  return [
    `Jev Agent Kit ${VERSION}: characters, from the last ${names.length} record files scanned for this project`,
    `assist: ${total.assist.logs} logs rewritten, ${total.assist.chars} chars removed net (after the receipt line)`,
    `observe: ${total.observe.logs} logs, ${total.observe.chars} chars assist would have removed`,
    `fell back to the original: ${total.fellBack}`,
    ...(total.jevAsked + total.jevNotAsked > 0 ? [`backend jev: answered by Jev for ${total.jevAsked} log(s); ${total.jevNotAsked} log(s) handled by the local rules only because Jev was not asked (every block was an error/warning line), so they say nothing about Jev. Failed requests are in the fell-back count.`] : []),
    'Counted characters only. This is not a token, cost or success measurement; see docs/EVALUATION.md.',
  ].join('\n')
}

// The side pane: the same counted characters and recent decisions as /jev savings and /jev status.
async function paneLines($: Engine): Promise<string[]> {
  const now = await $.clock.now()
  const root = await projectRoot($, await $.session.cwd())
  const age = now - paneCache.at
  if (root === paneCache.root && age >= 0 && age < 3000) return paneCache.lines
  const saves = (await savingsText($, 200)).split('\n')
  const status = (await statusText($)).split('\n')
  paneCache.lines = [...saves, '', ...status, '', '/jev doctor | /jev savings | /jev pane close']
  paneCache.at = now
  paneCache.root = root
  return paneCache.lines
}

async function paneCommand($: Engine, arg: string | undefined): Promise<string> {
  try {
    if (arg === 'close') {
      await $.ui.close({ id: PANE_ID })
      return 'Pane closed.'
    }
    paneCache.at = -Infinity
    const opened = await $.ui.open({ id: PANE_ID, title: 'Jev', closeOnEscape: true })
    return opened.isPlaced ? 'Jev pane opened. /jev pane close (or Esc) closes it.' : 'Jev pane is waiting: widen the terminal to see it.'
  } catch {
    return 'Could not open the pane here.'
  }
}

async function readbackText($: Engine, id: string): Promise<string> {
  if (!ARTIFACT_ID.test(id)) return 'Usage: /jev readback <32-hex artifact id>'
  const root = await projectRoot($, await $.session.cwd())
  try {
    const original = await $.fs.read(root + '/artifacts/' + id + '.log')
    stats.readbacks += 1 // the model needed the original: stop rewriting in this project for the rest of the session
    pausedRoots.add(root)
    return original
  } catch {
    return 'No artifact ' + id + ' for this project.'
  }
}

export function register(on: On, options?: PluginOptions) {
  pluginOptions = options ?? {}
  on('session.start', async ($, e, next) => {
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
      await $.command.register({ name: 'jev', description: 'Jev Agent Kit: status | doctor | savings | pane | readback <id> | on | off | mode <m> | init [m] | preset <name>', argumentHint: 'status|doctor|savings|pane|readback <id>|on|off|mode observe|assist|init [observe|assist]|preset <name>' })
    } catch {
      // A taken command name must not stop the session from starting.
    }
    return next(e)
  })

  on('command.run', { command: 'jev' }, async ($, e) => {
    const [sub, arg] = String(e.args ?? '').trim().split(/\s+/)
    if (sub === 'status') return { text: await statusText($) }
    if (sub === 'doctor') return { text: await doctorText($) }
    if (sub === 'readback') return { text: await readbackText($, arg ?? '') }
    if (sub === 'on') return { text: await setOption($, 'enable_all_projects', true) }
    if (sub === 'off') return { text: await setOption($, 'enable_all_projects', false) }
    if (sub === 'mode') return { text: arg === 'observe' || arg === 'assist' ? await setOption($, 'mode', arg) : 'Usage: /jev mode observe|assist' }
    if (sub === 'init') return { text: await initProject($, arg ?? 'observe') }
    if (sub === 'preset') return { text: await presetProject($, arg) }
    if (sub === 'savings') return { text: await savingsText($) }
    if (sub === 'pane') return { text: await paneCommand($, arg) }
    return { text: 'Usage: /jev status | doctor | savings | pane | readback <artifact id> | on | off | mode observe|assist | init [observe|assist] | preset <name>' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const lines = await paneLines($)
    // h returns a plain-data element; the render hook's type wants it narrowed.
    return h(Box, { flexDirection: 'column', paddingX: 1 }, ...lines.map((line) => h(Text, null, line))) as RenderElement
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const res = await next(e)
    // From here on any failure returns the untouched original result.
    try {
      if (res.deny !== undefined || res.result === undefined) return res
      const cwd = await $.session.cwd()
      const cfg = await loadConfig($, cwd)
      if (!cfg.enabled) return res
      const root = await projectRoot($, cwd)
      if (String(e.command ?? '').includes(root + '/artifacts/')) pausedRoots.add(root) // the model went back to the original
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
      // Claude Code cuts Bash output at BASH_MAX_OUTPUT_LENGTH (default 30000) before any hook runs and keeps
      // the complete text in its own file. At the cut we only see a head, so the original we would point to
      // is incomplete: leave the result alone (measured: rewriting it hid the tail from the model).
      const configured = Number(await $.env.get('BASH_MAX_OUTPUT_LENGTH'))
      const cap = Number.isFinite(configured) && configured > 0 ? configured : 30000
      if (charLength(out.stdout) >= cap * 0.99) {
        await recordDecision($, root, { feature: 'host_truncation', reason: 'host_truncated_output', input_chars: charLength(out.stdout) })
        return res
      }

      stats.seen += 1
      const artifactId = (await sha256Hex(JSON.stringify(out.stdout))).slice(0, 32)
      await writePrivate($, root + '/artifacts/' + artifactId + '.log', out.stdout)
      if (pausedRoots.has(root) && cfg.mode === 'assist') {
        // A read-back means pruning cost the model something; keep the originals from here on.
        await recordDecision($, root, { feature: 'readback_pause', reason: 'paused_after_readback' })
        await showStatus($, cfg)
        return res
      }
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
      const stdout = canRewrite ? output + '\n[Jev agent kit: pruned ' + charLength(out.stdout) + ' -> ' + charLength(output) + ' chars. The full original is in the file ' + root + '/artifacts/' + artifactId + '.log (read it with your Read tool or cat); the user can run /jev readback ' + artifactId + ']\n' : out.stdout
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
      try { await $.ui.log('internal error while pruning (original output kept)', { to: 'debug' }) } catch { /* diagnostics must not throw */ }
      await notifyOnce($, 'internal_error', 'internal error while pruning; original output kept. Run claude --debug to investigate.')
      return res
    }
  })
}
