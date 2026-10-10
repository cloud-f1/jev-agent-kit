// Shared constants and types for the Jev Agent Kit TypeScript core. Pure: no mods API.

export const VERSION = '0.6.0'
export const QUESTION_VERSION = 'log-keep-v1'
export const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
export const MODEL = 'jev-1.13.0' // default request model: pinned so decisions stay calibrated
const JEV_MODEL_NAME = /^jev-[A-Za-z0-9._-]{1,40}$/

// Any jev-* name is allowed (e.g. jev-latest); the endpoint is fixed regardless.
export function isJevModel(name: unknown): name is string {
  return typeof name === 'string' && JEV_MODEL_NAME.test(name)
}
export const MAX_BYTES = 256_000
export const JEV_PRICE_PER_INPUT_TOKEN_USD = 0.042 / 1_000_000

export type Mode = 'observe' | 'assist'
export type Backend = 'rules' | 'jev'

export interface Config {
  schemaVersion: 1
  enabled: boolean
  mode: Mode
  backend: Backend
  minimumChars: number
  timeoutSeconds: number
  keepThreshold: number
  retentionDays: number
}

export interface Block {
  id: string
  start: number
  end: number
  text: string
}

export interface PruneMeta {
  plugin_version: string
  question_version: string
  backend: Backend
  reason: string
  input_chars: number
  output_chars?: number
  api_input_tokens: number | null
  api_output_tokens: number | null
  jev_cost_usd_estimate: number | null
  cost_complete: boolean
  requested_model?: string
  actual_model?: string | null
  latency_ms?: number
}

// Only fixed diagnostic categories may leave the transport; never exception text.
export class JevError extends Error {
  reason: string
  constructor(reason: string) {
    super(reason)
    this.reason = reason
  }
}

// Sends one /v1/systemone request and returns the parsed JSON body.
// Built inside the Mod from $.http.fetch; tests pass a stub. Must throw JevError for failures.
export type Transport = (body: Record<string, unknown>) => Promise<unknown>
