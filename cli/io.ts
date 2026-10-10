// Node-only I/O for the maintainer CLI. The plugin itself (hooks/, core/) never imports this.
// State layout, permissions and the request rules match the Mod (hooks/register.ts).
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { parseEnvFile } from '../core/config.ts'
import { ENDPOINT, JevError, MAX_BYTES } from '../core/contracts.ts'
import type { Transport } from '../core/contracts.ts'
import { digestString } from '../core/hash.ts'

// Trusted environment, never repo config. Only "~" and "~/..." are expanded; anything not
// absolute afterwards is ignored so state can never land in a repo.
export function stateBase(env: Record<string, string | undefined> = process.env, home: string = homedir()): string {
  const fallback = join(home, '.cache', 'jev-agent-kit')
  let raw = env.JEV_STATE_DIR
  if (!raw) return fallback
  if (raw === '~' || raw.startsWith('~/')) raw = home + raw.slice(1)
  return isAbsolute(raw) ? raw : fallback
}

export async function rootFor(project: string, env: Record<string, string | undefined> = process.env): Promise<string> {
  let physical: string
  try {
    physical = realpathSync.native(project)
  } catch {
    physical = resolve(project)
  }
  return join(stateBase(env), (await digestString(physical)).slice(0, 24))
}

// Owner-only files (0600) and every newly created directory level (0700), whatever the umask.
export function privateWrite(path: string, text: string): void {
  const old = process.umask(0o077)
  try {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    writeFileSync(path, text, { encoding: 'utf8', mode: 0o600 })
    chmodSync(path, 0o600)
  } finally {
    process.umask(old)
  }
}

export function readback(root: string, id: string): string {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('invalid_artifact_id')
  return readFileSync(join(root, 'artifacts', id + '.log'), 'utf8')
}

// Explicit dotenv file; only TYPESAFE_API_KEY is accepted; nothing is evaluated.
export function loadEnv(path: string | undefined, env: Record<string, string | undefined> = process.env): void {
  if (!path) return
  const key = parseEnvFile(readFileSync(path, 'utf8'))
  if (key && env.TYPESAFE_API_KEY === undefined) env.TYPESAFE_API_KEY = key
}

// The only network path of the CLI. Fixed endpoint; redirects are an error; failures become fixed
// reason codes, never response bodies or exception text.
export function httpTransport(key: string | undefined, timeoutSeconds = 3, fetchImpl: typeof fetch = fetch): Transport {
  return async (body) => {
    if (!key || key === 'REPLACE_ME') throw new JevError('missing_key')
    const encoded = JSON.stringify(body)
    if (new TextEncoder().encode(encoded).length > MAX_BYTES) throw new JevError('request_too_large')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000)
    let text = ''
    try {
      const response = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: encoded,
        redirect: 'error',
        signal: controller.signal,
      })
      if (!response.ok) throw new JevError('http_' + response.status)
      // The deadline also covers the body, and the size cap is applied while reading.
      const reader = response.body?.getReader()
      const aborted = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      })
      aborted.catch(() => {})
      const chunks: Uint8Array[] = []
      let size = 0
      for (let part = await Promise.race([reader?.read(), aborted]); part && !part.done; part = await Promise.race([reader!.read(), aborted])) {
        size += part.value.byteLength
        if (size > MAX_BYTES) {
          controller.abort()
          throw new JevError('response_too_large')
        }
        chunks.push(part.value)
      }
      text = new TextDecoder().decode(Buffer.concat(chunks))
    } catch (error) {
      if (error instanceof JevError) throw error
      throw new JevError((error as { name?: string })?.name === 'AbortError' ? 'timeout' : 'transport_or_json_error')
    } finally {
      clearTimeout(timer)
    }
    try {
      return JSON.parse(text)
    } catch {
      throw new JevError('transport_or_json_error')
    }
  }
}

export function pathExists(path: string): boolean {
  return existsSync(path)
}
