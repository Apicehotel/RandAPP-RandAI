import { useEffect, useState } from 'react'
import { isKeyboardOpen } from './keyboard.js'

export function useKeyboardOpen() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return undefined
    const check = () => setOpen(isKeyboardOpen(window.innerHeight, vv.height))
    check()
    vv.addEventListener('resize', check)
    return () => vv.removeEventListener('resize', check)
  }, [])
  return open
}
