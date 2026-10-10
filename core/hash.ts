// SHA-256 helpers. Pure: no mods API. Digests are pinned by tests/fixtures/golden.ts.

export async function sha256Hex(text: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new Uint8Array(new TextEncoder().encode(text)))
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')
}

// digest(value) = sha256 of the JSON text of a plain string (sorted keys, non-ASCII kept as is).
// For a plain string that is the sha256 of its JSON encoding, which JSON.stringify reproduces.
export function digestString(value: string): Promise<string> {
  return sha256Hex(JSON.stringify(value))
}
