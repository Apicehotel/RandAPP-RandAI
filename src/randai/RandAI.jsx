import { useEffect, useRef, useState } from 'react'
import { askRandAI } from './client.js'
import { Icon } from '../ui/kit.jsx'

// Chat con RandAI. La schermata è pronta; finché `live` è falso il campo di scrittura resta spento.
export default function RandAI({ live = false, ctx = {} }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef(null)

  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end' }) }, [messages, busy])

  async function send(e) {
    e.preventDefault()
    const q = text.trim()
    if (!q || busy || !live) return
    const next = [...messages, { role: 'user', text: q }]
    setMessages(next)
    setText('')
    setBusy(true)
    try {
      const reply = await askRandAI({ hotelId: ctx.hotelId, messages: next })
      setMessages([...next, { role: 'ai', text: String(reply) }])
    } catch (err) {
      setMessages([...next, { role: 'ai', text: err.message, error: true }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="chat">
      <div className="chat-log" role="log" aria-live="polite">
        <div className="bubble ai">
          <strong>RandAI</strong>
          <span>{live ? 'Ciao! Chiedimi qualcosa su segnalazioni, interventi, planning o sensori.' : 'La chat è pronta ma RandAI è in pausa: verrà attivato dopo il lancio dell\'app.'}</span>
        </div>
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}${m.error ? ' error' : ''}`}>{m.text}</div>
        ))}
        {busy && <div className="bubble ai muted">Sto pensando…</div>}
        <div ref={end} />
      </div>
      <form className="chat-compose" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={live ? 'Scrivi a RandAI…' : 'RandAI è in pausa'}
          disabled={!live}
          maxLength={1000}
          aria-label="Messaggio per RandAI"
        />
        <button type="submit" className="btn primary" disabled={!live || busy || !text.trim()} aria-label="Invia">
          <Icon name="send" size={18} />
        </button>
      </form>
    </div>
  )
}
