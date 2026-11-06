import { useEffect, useRef, useState } from 'react'
import { similarCases, logAi, giveFeedback } from '../data/ai.js'
import { shouldSearch, scrubText } from '../lib/ai.js'
import { formatDate } from './kit.jsx'

// "Casi simili già risolti": ricerca nello storico (nessun modello, gratis). Ogni volta che compare e ogni giudizio
// ("Utile / Non utile") finiscono nel registro: sono gli esempi con cui, più avanti, si potrà allenare un modello locale.
export default function SimilarCases({ ctx, query, exclude = null }) {
  const [cases, setCases] = useState([])
  const [logId, setLogId] = useState(null)
  const [voted, setVoted] = useState('')
  const lastLogged = useRef('')

  useEffect(() => {
    if (!shouldSearch(query)) { setCases([]); return undefined }
    let cancelled = false
    const timer = setTimeout(async () => {
      const started = Date.now()
      try {
        const found = await similarCases(ctx.hotelId, query, { limit: 3, exclude })
        if (cancelled) return
        setCases(found)
        setVoted('')
        setLogId(null)
        const key = `${query}|${found.map((c) => c.id).join(',')}`
        if (found.length > 0 && key !== lastLogged.current) {
          lastLogged.current = key
          const id = await logAi(ctx.hotelId, {
            feature: 'similar_cases', source: 'history',
            input: { q: scrubText(query).slice(0, 300) },
            output: { ids: found.map((c) => c.id) },
            confidence: Math.min(1, Math.max(...found.map((c) => Number(c.rank) || 0)) * 10),
            latency: Date.now() - started,
          })
          if (!cancelled) setLogId(id)
        }
      } catch {
        if (!cancelled) setCases([])
      }
    }, 700)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [ctx.hotelId, query, exclude])

  const vote = async (verdict) => {
    setVoted(verdict)
    try { await giveFeedback(logId, verdict) } catch { /* il giudizio è facoltativo */ }
  }

  if (cases.length === 0) return null
  return (
    <section className="card stack" aria-label="Casi simili già risolti" data-testid="similar-cases">
      <h2>Casi simili già risolti</h2>
      {cases.map((c) => (
        <a key={c.id} className="stack" href={`#/issues/${c.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <strong>{c.title}</strong>
          <span className="muted">{[c.room, c.category, c.completed_at && formatDate(c.completed_at)].filter(Boolean).join(' · ')}</span>
          {c.completion_note && <span>Soluzione: {c.completion_note}</span>}
          {c.part_replaced && <span>Ricambio: {c.part_replaced}</span>}
        </a>
      ))}
      {logId && (
        <div className="row" role="group" aria-label="Questi casi sono utili?">
          <span className="muted">{voted ? 'Grazie.' : 'Utili?'}</span>
          <span>
            <button type="button" className="chip" aria-pressed={voted === 'up'} onClick={() => vote('up')}>Sì</button>{' '}
            <button type="button" className="chip" aria-pressed={voted === 'down'} onClick={() => vote('down')}>No</button>
          </span>
        </div>
      )}
    </section>
  )
}
