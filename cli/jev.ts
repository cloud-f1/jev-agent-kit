#!/usr/bin/env node
// Maintainer and evaluation CLI (Node >= 22.18 runs this file directly; no build step).
// End users do not need it: the plugin is hooks/register.ts. This file imports the same pure core
// (core/*.ts) the Mod uses, so there is exactly one implementation of pruning and validation.
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { mergeConfig } from '../core/config.ts'
import { ENDPOINT, JevError, MODEL, VERSION } from '../core/contracts.ts'
import type { Transport } from '../core/contracts.ts'
import { prune, validateNouls, validateResponse } from '../core/prune.ts'
import { httpTransport, loadEnv, privateWrite, readback, rootFor } from './io.ts'
import { markdown, report } from './metrics.ts'

const emit = (obj: unknown) => console.log(JSON.stringify(obj, null, 2))

// Mock Jev: relevance by a planted marker. Fake usage is explicitly not a real API cost.
export const mockTransport: Transport = async (body) => {
  const blocks = (body.state as { blocks: Array<{ id: string; text: string }> }).blocks
  const answers: Record<string, unknown> = {}
  for (const id of Object.keys(body.questions as object)) {
    const block = blocks.find((b) => b.id === id)
    answers[id] = { type: 'noul', noul: block?.text.includes('IMPORTANT_BUSINESS_CONTEXT') ? 0.99 : 0.01 }
  }
  return { model: MODEL, answers, usage: { input_tokens: 0, output_tokens: 0 } }
}

// CLAUDE_PLUGIN_OPTION_<NAME> is how Claude Code hands plugin settings to processes it starts.
const OPTION_ENV: Record<string, string> = {
  mode: 'MODE', backend: 'BACKEND', minimum_chars: 'MINIMUM_CHARS',
  keep_threshold: 'KEEP_THRESHOLD', retention_days: 'RETENTION_DAYS', enable_all_projects: 'ENABLE_ALL_PROJECTS',
}

export function optionsFromEnv(env: Record<string, string | undefined>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [option, suffix] of Object.entries(OPTION_ENV)) {
    const raw = env['CLAUDE_PLUGIN_OPTION_' + suffix]
    if (!raw) continue
    if (option === 'enable_all_projects') out[option] = raw.toLowerCase() === 'true' ? true : raw.toLowerCase() === 'false' ? false : raw
    else if (option === 'mode' || option === 'backend') out[option] = raw
    else out[option] = Number(raw)
  }
  return out
}

export function loadProjectConfig(project: string, env: Record<string, string | undefined> = process.env) {
  const path = join(project, '.claude', 'jev-agent-kit.json')
  const raw = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined
  return mergeConfig(optionsFromEnv(env), raw).config
}

const nowMs = () => performance.now()

export async function logBench(outdir: string, live: boolean, transport?: Transport): Promise<number> {
  mkdirSync(outdir, { recursive: true })
  const rows: Array<Record<string, any>> = []
  const names = ['build', 'test', 'migration', 'deploy', 'dependency']
  for (const [index, name] of names.entries()) {
    const lines = Array.from({ length: 320 }, (_, i) => `progress item ${i}\n`)
    const critical = `ERROR ${name}: expected contract ${index}, got invalid\n`
    const context = `IMPORTANT_BUSINESS_CONTEXT tenant_region_${index} explains this ${name}\n`
    lines[141] = critical
    lines[47] = context
    const text = lines.join('')
    privateWrite(join(outdir, name + '-raw.log'), text)
    for (const arm of ['baseline', 'local', live ? 'jev' : 'mock_jev']) {
      const start = nowMs()
      let output: string
      let meta: Record<string, any>
      if (arm === 'baseline') {
        output = text
        meta = { reason: 'baseline', jev_cost_usd_estimate: 0 }
      } else {
        const result = await prune(text, {
          backend: arm === 'local' ? 'rules' : 'jev', goal: `Diagnose ${name} and retain relevant business context`,
          threshold: 0.8, transport: arm === 'local' ? undefined : live ? transport : mockTransport, now: nowMs,
        })
        output = result.output
        meta = { ...result.meta }
      }
      if (arm === 'mock_jev') meta.jev_cost_usd_estimate = null
      const evidence = [critical.trim(), context.trim()]
      rows.push({
        ...meta, record_type: 'log_proxy', fixture: name, arm,
        evidence_retention: evidence.filter((x) => output.includes(x)).length / evidence.length,
        error_retention: output.includes(critical.trim()),
        character_reduction: 1 - [...output].length / [...text].length,
        measured_latency_ms: nowMs() - start,
      })
      privateWrite(join(outdir, `${name}-${arm}.log`), output)
    }
  }
  privateWrite(join(outdir, 'log-proxy.json'), JSON.stringify(rows, null, 2))
  const table = ['# Log proxy comparison', '', '**Synthetic fixtures only. No agent task success or downstream dollar savings are measured.**', '',
    '| Fixture | Arm | Char reduction | Evidence retained | Error retained | Latency ms |', '|---|---|---:|---:|---|---:|']
  for (const r of rows) {
    table.push(`| ${r.fixture} | ${r.arm} | ${(r.character_reduction * 100).toFixed(1)}% | ${(r.evidence_retention * 100).toFixed(0)}% | ${r.error_retention} | ${r.measured_latency_ms.toFixed(3)} |`)
  }
  privateWrite(join(outdir, 'log-proxy.md'), table.join('\n') + '\n')
  emit({ report: join(outdir, 'log-proxy.md'), mode: live ? 'live' : 'mock', live_valid_decisions: rows.filter((r) => r.reason === 'ok' && r.arm === 'jev').length })
  return !live || rows.filter((r) => r.arm === 'jev').every((r) => r.reason === 'ok') ? 0 : 3
}

function onPath(binary: string, env = process.env): boolean {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : ['']
  return (env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':').some((dir) => dir && exts.some((e) => existsSync(join(dir, binary + e))))
}

export async function main(argv: string[], env: Record<string, string | undefined> = process.env): Promise<number> {
  const [cmd, ...rest] = argv.filter((a) => !a.startsWith('--env-file'))
  const envFileArg = argv.find((a) => a.startsWith('--env-file='))?.slice('--env-file='.length)
    ?? (argv.includes('--env-file') ? argv[argv.indexOf('--env-file') + 1] : undefined)
  try {
    loadEnv(envFileArg ?? env.JEV_ENV_FILE, env)
    const opts = parseArgs({
      args: rest.filter((a) => a !== envFileArg),
      allowPositionals: true,
      options: {
        outdir: { type: 'string' }, live: { type: 'boolean' }, project: { type: 'string' },
        manifest: { type: 'string' }, records: { type: 'string' },
      },
    })
    const project = opts.values.project ?? '.'
    if (cmd === 'doctor') {
      emit({
        node: process.versions.node, claude_cli_available: onPath('claude', env as NodeJS.ProcessEnv),
        jev_key_present: Boolean(env.TYPESAFE_API_KEY), kit_version: VERSION, endpoint: ENDPOINT, model: MODEL,
        note: 'Key presence is not authentication validation. This reports the CLI side only; the native Mod ships in hooks/register.ts (use /jev doctor in a session).',
      })
    } else if (cmd === 'smoke') {
      const body = { model: MODEL, state: 'A unit test failed.', questions: { failed: { type: 'noul', instructions: 'Does the state say that a unit test failed?' } } }
      const obj = await httpTransport(env.TYPESAFE_API_KEY)(body)
      const { usage, model } = validateResponse(obj, MODEL)
      emit({ status: 'api_validated', answers: validateNouls(obj, ['failed']), model, usage })
    } else if (cmd === 'bench-logs') {
      const live = Boolean(opts.values.live)
      return await logBench(opts.values.outdir ?? 'results/logs', live, live ? httpTransport(env.TYPESAFE_API_KEY) : undefined)
    } else if (cmd === 'check-config') {
      emit(loadProjectConfig(project, env))
    } else if (cmd === 'readback') {
      process.stdout.write(readback(await rootFor(project, env), opts.positionals[0] ?? ''))
    } else if (cmd === 'status') {
      const folder = join(await rootFor(project, env), 'decisions')
      const names = existsSync(folder) ? readdirSync(folder).filter((n) => n.endsWith('.json')).sort() : []
      const rows = names.map((n) => JSON.parse(readFileSync(join(folder, n), 'utf8')))
      emit({ project_records: rows.length, recent: rows.slice(-10), note: 'Hook decisions are not agent success measurements.' })
    } else if (cmd === 'report') {
      if (!opts.values.manifest || !opts.values.records) throw new Error('missing_arguments')
      const manifest = JSON.parse(readFileSync(opts.values.manifest, 'utf8'))
      const rows = readFileSync(opts.values.records, 'utf8').split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l))
      const obj = report(manifest, rows)
      const dir = opts.values.outdir ?? 'results/agent'
      privateWrite(join(dir, 'agent-report.json'), JSON.stringify(obj, null, 2))
      privateWrite(join(dir, 'agent-report.md'), markdown(obj))
      emit({ report: join(dir, 'agent-report.md'), status: obj.status })
      return obj.status === 'COMPLETE' ? 0 : 4
    } else {
      console.error('usage: node cli/jev.ts [--env-file PATH] doctor | smoke | bench-logs [--live] [--outdir D] | status | readback ID | check-config [--project P] | report --manifest M --records R [--outdir D]')
      return 2
    }
  } catch (error) {
    if (error instanceof JevError) {
      emit({ status: 'no_verdict', reason: error.reason })
      return 3
    }
    emit({ status: 'error', reason: 'invalid_input_or_local_io' })
    return 2
  }
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main(process.argv.slice(2))
