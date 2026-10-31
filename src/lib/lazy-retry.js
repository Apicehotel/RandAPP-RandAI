import { lazy } from 'react'

// Dopo un nuovo deploy un vecchio chunk può non esistere più: si ricarica la pagina una sola volta.
export function lazyWithRetry(factory) {
  return lazy(async () => {
    try {
      return await factory()
    } catch (error) {
      let already = false
      try {
        already = sessionStorage.getItem('randapp.chunk-retry') === '1'
        sessionStorage.setItem('randapp.chunk-retry', '1')
      } catch {
        already = true
      }
      if (!already) {
        window.location.reload()
        return new Promise(() => {})
      }
      throw error
    }
  })
}
