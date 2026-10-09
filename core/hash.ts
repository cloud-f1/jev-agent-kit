// SHA-256 helpers. Pure: no mods API. Matches the Python core's digest() for plain strings.

export async function sha256Hex(text: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')
}

// Python: digest(value) = sha256(json.dumps(value, sort_keys=True, ensure_ascii=False)).
// For a plain string that is the sha256 of its JSON encoding, which JSON.stringify reproduces.
export function digestString(value: string): Promise<string> {
  return sha256Hex(JSON.stringify(value))
}
