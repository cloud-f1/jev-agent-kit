// Project config validation. Pure: the Mod reads the file and passes parsed JSON in.
import { MAX_BYTES } from './contracts.ts'
import type { Config } from './contracts.ts'

const DEFAULTS: Config = {
  schemaVersion: 1,
  enabled: false,
  mode: 'observe',
  backend: 'rules',
  minimumChars: 8000,
  timeoutSeconds: 3.0,
  keepThreshold: 0.8,
  retentionDays: 7,
}

const RANGES: Array<[keyof Config, number, number]> = [
  ['minimumChars', 0, MAX_BYTES],
  ['timeoutSeconds', 0.1, 10],
  ['keepThreshold', 0, 1],
  ['retentionDays', 1, 30],
]

export function defaultConfig(): Config {
  return { ...DEFAULTS }
}

// Mirrors the Python core.config(): unknown fields, wrong types and out-of-range values throw.
export function validateConfig(raw: unknown): Config {
  const result: Record<string, unknown> = { ...DEFAULTS }
  if (raw !== undefined) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('unsupported_config_fields')
    for (const key of Object.keys(raw)) {
      if (!(key in DEFAULTS)) throw new Error('unsupported_config_fields')
    }
    Object.assign(result, raw)
  }
  if (result.schemaVersion !== 1) throw new Error('unsupported_schema')
  if (typeof result.enabled !== 'boolean') throw new Error('invalid_enabled')
  if (!['observe', 'assist'].includes(result.mode as string) || !['rules', 'jev'].includes(result.backend as string)) {
    throw new Error('invalid_mode_or_backend')
  }
  for (const [key, low, high] of RANGES) {
    const value = result[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) {
      throw new Error('invalid_' + key)
    }
  }
  return result as unknown as Config
}

// Explicit dotenv parsing: only TYPESAFE_API_KEY is accepted; nothing is evaluated.
export function parseEnvFile(text: string): string | undefined {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = line.indexOf('=')
    if (line.slice(0, index).trim() !== 'TYPESAFE_API_KEY') continue
    const value = line.slice(index + 1).trim().replace(/^["']+|["']+$/g, '')
    if (value && value !== 'REPLACE_ME') return value
  }
  return undefined
}
