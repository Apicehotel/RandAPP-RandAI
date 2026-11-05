import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { readLog, clearLog, formatLog, classify, CAUSES } from '../lib/errorlog.js'
import { useAsync } from '../lib/hooks.js'
import { Button, ErrorText, Spinner } from '../ui/kit.jsx'

const when = (iso) => {
  try { return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) } catch { return iso }
}

const CAUSE_STYLE = {
  app: { background: 'var(--danger, #b3261e)', color: '#fff' },
  utente: { background: 'var(--warn, #b26a00)', color: '#fff' },
  dispositivo: { background: 'var(--muted-bg, #5f6368)', color: '#fff' },
}

// Righe vecchie o senza verdetto (salvate prima): si rivaluta qui.
const verdictOf = (r) => (r.cause ? { cause: r.cause, hint: r.hint, probable: r.probable } : classify(r))

function Row({ r }) {
  const v = verdictOf(r)
  return (
    <div className="card stack">
      <div className="row">
        <span>
          <span className="badge" style={{ ...CAUSE_STYLE[v.cause], padding: '2px 8px', borderRadius: 999, marginRight: 8, fontSize: '0.8em' }}>
            Causa: {CAUSES[v.cause]?.label}{v.probable ? ' (probabile)' : ''}
          </span>
          <strong>{r.kind}</strong>
        </span>
        <span className="muted">{when(r.at)}</span>
      </div>
      <div>{r.message}</div>
      {v.hint && <div><strong>Cosa fare:</strong> {v.hint}</div>}
      {r.detail && <pre className="muted" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0, fontSize: '0.85em' }}>{r.detail}</pre>}
      {(r.route || r.device) && <div className="muted" style={{ fontSize: '0.85em', overflowWrap: 'anywhere' }}>{[r.route, r.hotel_id, r.device].filter(Boolean).join(' · ')}</div>}
    </div>
  )
}

function Summary({ rows, filter, setFilter }) {
  const count = (c) => rows.filter((r) => verdictOf(r).cause === c).length
  const items = [{ id: 'tutti', label: `Tutti (${rows.length})` }, ...Object.entries(CAUSES).map(([id, c]) => ({ id, label: `${c.label} (${count(id)})` }))]
  return (
    <div className="chips" role="group" aria-label="Filtro causa">
      {items.map((i) => (
        <button key={i.id} className="chip" aria-pressed={filter === i.id} onClick={() => setFilter(i.id)}>{i.label}</button>
      ))}
    </div>
  )
}
const byFilter = (rows, filter) => (filter === 'tutti' ? rows : rows.filter((r) => verdictOf(r).cause === filter))

// Errori di questo dispositivo: funziona anche prima del login e senza rete.
export function LocalErrors() {
  const [rows, setRows] = useState(readLog)
  const [msg, setMsg] = useState('')
  const [filter, setFilter] = useState('tutti')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatLog(rows))
      setMsg('Copiato. Incollalo dove ti serve.')
    } catch {
      setMsg('Copia non riuscita: seleziona il testo a mano.')
    }
  }
  return (
    <div className="stack">
      <div className="row">
        <Button onClick={() => setRows(readLog())}>Aggiorna</Button>
        <Button onClick={copy} disabled={rows.length === 0}>Copia tutto</Button>
        <Button variant="danger" onClick={() => { clearLog(); setRows([]); setMsg('') }} disabled={rows.length === 0}>Svuota</Button>
      </div>
      {msg && <p role="status">{msg}</p>}
      {rows.length === 0 && <div className="card muted">Nessun errore su questo dispositivo.</div>}
      {rows.length > 0 && <Summary rows={rows} filter={filter} setFilter={setFilter} />}
      {byFilter(rows, filter).map((r, i) => <Row key={`${r.at}-${i}`} r={r} />)}
    </div>
  )
}

// Errori di tutti i dispositivi: li vedono solo gli admin.
function ServerErrors() {
  const [filter, setFilter] = useState('tutti')
  const { data, error, loading, reload } = useAsync(async () => {
    const since = new Date(Date.now() - 7 * 86400000).toISOString()
    const { data: rows, error: e } = await supabase
      .from('app_errors').select('id,at,hotel_id,kind,message,detail,route,device,cause,hint')
      .gte('at', since).order('at', { ascending: false }).limit(200)
    if (e) throw new Error('Impossibile caricare il registro')
    return rows || []
  }, [])
  return (
    <div className="stack">
      <div className="row"><h2>Tutti i dispositivi (7 giorni)</h2><Button onClick={reload}>Aggiorna</Button></div>
      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      {data && data.length === 0 && <div className="card muted">Nessun errore negli ultimi 7 giorni.</div>}
      {data && data.length > 0 && <Summary rows={data} filter={filter} setFilter={setFilter} />}
      {byFilter(data || [], filter).map((r) => <Row key={r.id} r={r} />)}
    </div>
  )
}

export default function ErrorLog({ ctx }) {
  return (
    <div className="page">
      <h1>Registro errori</h1>
      <p className="muted">Qui compare cosa non funziona, con la causa. Se qualcosa non va, tocca "Copia tutto" e mandalo.</p>
      <h2>Questo dispositivo</h2>
      <LocalErrors />
      {ctx?.role === 'admin' && <ServerErrors />}
    </div>
  )
}
