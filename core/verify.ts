// Checks whether an API key is accepted, with one synthetic request. Pure: the transport (and so the
// network, the key and the clock) is passed in. Only fixed words are returned, never a body, header,
// exception text or the key.
import { JevError, MODEL } from './contracts.ts'
import type { Transport } from './contracts.ts'
import { validateResponse } from './prune.ts'

export function smokeBody(model: string = MODEL) {
  return { model, state: 'A unit test failed.', questions: { failed: { type: 'noul', instructions: 'Does the state say that a unit test failed?' } } }
}

// 'missing' (no request is made), 'valid', 'invalid (401|403)', or 'error (<fixed reason>)'.
export async function verifyKey(key: string | undefined, transport: Transport | undefined, model: string = MODEL): Promise<string> {
  if (!key || key === 'REPLACE_ME' || !transport) return 'missing'
  try {
    validateResponse(await transport(smokeBody(model)), model)
    return 'valid'
  } catch (error) {
    if (error instanceof JevError) return error.reason === 'http_401' || error.reason === 'http_403' ? `invalid (${error.reason.slice(5)})` : `error (${error.reason})`
    return 'error (transport)'
  }
}
