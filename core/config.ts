// Project config validation. Pure: the Mod reads the file and passes parsed JSON in.
import { isJevModel, MAX_BYTES } from './contracts.ts'
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

// Unknown fields, wrong types and out-of-range values throw.
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

// ---- Plugin settings (userConfig) layer --------------------------------------------------------
// Precedence: built-in defaults < plugin settings (user-wide, /config) < project file.
// Plugin settings come from `register(on, options)`; a bad value is ignored (and reported by
// describeSources), never allowed to break the session.

export type Source = 'default' | 'plugin settings' | 'project file'

const OPTION_TO_FIELD: Record<string, keyof Config> = {
  mode: 'mode',
  backend: 'backend',
  minimum_chars: 'minimumChars',
  keep_threshold: 'keepThreshold',
  retention_days: 'retentionDays',
  enable_all_projects: 'enabled',
}

export function userDefaults(options: unknown): Partial<Config> {
  const out: Record<string, unknown> = {}
  if (typeof options !== 'object' || options === null) return out
  for (const [option, field] of Object.entries(OPTION_TO_FIELD)) {
    const value = (options as Record<string, unknown>)[option]
    if (value === undefined || value === '') continue
    try {
      validateConfig({ [field]: value }) // one field at a time: a bad one is skipped, not fatal
      out[field] = value
    } catch {
      // Ignored on purpose; describeSources reports it.
    }
  }
  return out as Partial<Config>
}

export function mergeConfig(options: unknown, projectRaw: unknown): { config: Config; sources: Record<string, Source> } {
  const sources: Record<string, Source> = {}
  const merged: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(userDefaults(options))) {
    merged[field] = value
    sources[field] = 'plugin settings'
  }
  if (projectRaw !== undefined) {
    const checked = validateConfig(projectRaw) // throws on unknown fields / bad values
    for (const field of Object.keys(projectRaw as object)) {
      merged[field] = (checked as unknown as Record<string, unknown>)[field]
      sources[field] = 'project file'
    }
  }
  const config = validateConfig(merged)
  for (const field of Object.keys(DEFAULTS)) sources[field] ??= 'default'
  return { config, sources }
}

// The model from plugin settings only (never a project file). Anything but a jev-* name is ignored.
export function pluginModel(options: unknown): string | undefined {
  const value = (options as Record<string, unknown> | null)?.model
  return isJevModel(value) ? value : undefined
}

// The key from plugin settings (secure storage); never logged, only its presence is reported.
export function pluginKey(options: unknown): string | undefined {
  const value = (options as Record<string, unknown> | null)?.typesafe_api_key
  return typeof value === 'string' && value !== '' && value !== 'REPLACE_ME' ? value : undefined
}
