// Recupero di UNA lettura fallita per «JWT issued at future» (orologi non allineati tra telefono/server):
// si rinnova la sessione una volta e si rilegge. Mai per le scritture, mai più di un tentativo, nessun token nei log.

export const JWT_CLOCK_USER_MESSAGE = 'La sessione non è ancora valida per un problema di orario: riprova tra qualche secondo o esci e rientra con il PIN.'

export function isFutureJwtError(error) {
  const text = [error?.message, error?.details, error?.hint, error?.error_description].filter(Boolean).join(' ')
  return /JWT issued at future/i.test(text)
}

async function defaultRefresh() {
  const { supabase } = await import('./supabase.js')
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  if (!data?.session?.refresh_token) return false
  const { error } = await supabase.auth.refreshSession()
  return !error
}

export async function readWithJwtRecovery(read, refresh = defaultRefresh) {
  try {
    return await read()
  } catch (error) {
    if (!isFutureJwtError(error)) throw error
    let ok = false
    try { ok = await refresh() } catch { ok = false }
    if (!ok) throw new Error(JWT_CLOCK_USER_MESSAGE, { cause: error })
    return read()
  }
}
