import { useEffect, useRef, useState } from 'react'
import { getIssueThumb } from '../data/issues.js'
import { Icon } from './kit.jsx'

// Quadratino 58px a destra della scheda (come HotelGio). La foto si scarica solo quando la scheda
// entra nello schermo; finché non arriva (o se manca) resta il riquadro con la fotocamera.
export default function IssueThumb({ hotelId, issueId }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  const [src, setSrc] = useState(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined }
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } }, { rootMargin: '200px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return undefined
    let alive = true
    getIssueThumb(hotelId, issueId).then((s) => { if (alive) setSrc(s) }).catch(() => {})
    return () => { alive = false }
  }, [visible, hotelId, issueId])

  return (
    <span ref={ref} className="issue-thumb" aria-label="Con foto">
      {src ? <img src={src} alt="" decoding="async" onError={() => setSrc(null)} /> : <Icon name="camera" size={20} />}
    </span>
  )
}
