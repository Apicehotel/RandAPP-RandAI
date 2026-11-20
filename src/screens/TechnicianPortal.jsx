import { useEffect, useState } from 'react'
import { getPortalJob, sendPortalEvent } from '../data/technician-links.js'
import { tokenFromPortalRoute } from '../lib/technician-portal.js'
import { apiceLogo } from '../lib/hotels.js'
import { Button, ErrorText, Spinner, formatDate } from '../ui/kit.jsx'

const URGENCY = { urgente: 'Urgente', alta: 'Alta', normale: 'Normale', bassa: 'Bassa' }
const EVENT = { arrival: 'Arrivo comunicato', started: 'Intervento iniziato', note: 'Nota', completion_requested: 'Intervento terminato' }


// Pagina pubblica del tecnico (come la vecchia app): arrivo, inizio, note, «intervento terminato».
// La segnalazione la chiude il personale. Nessun accesso all'app: vale solo il codice del link.
export default function TechnicianPortal({ route }) {
  const token = tokenFromPortalRoute(route)
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!token) { setInvalid(true); setLoading(false); return }
    getPortalJob(token)
      .then(setJob)
      .catch((e) => { if (e.status === 404) setInvalid(true); else setError(e.message) })
      .finally(() => setLoading(false))
  }, [token])

  const send = async (kind, text = '') => {
    setBusy(true)
    setError('')
    try {
      const next = await sendPortalEvent(token, kind, text)
      if (next) setJob(next)
      if (kind === 'note') setNote('')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const events = job?.events || []
  const has = (k) => events.some((e) => e.kind === k)
  const closed = job?.status === 'completata'

  return (
    <div className="center">
      <div className="auth-box login">
        <div className="login-brand">
          <img className="brand-logo" src={apiceLogo} alt="ApiceHotel" width="96" height="96" />
          <h1>Intervento</h1>
          {job?.hotel && <strong>{job.hotel}</strong>}
        </div>
        {loading && <Spinner />}
        {invalid && <div className="card"><p className="error" role="alert">Link non valido o scaduto. Chiedi al personale di inviartene uno nuovo.</p></div>}
        {job && (
          <div className="stack">
            <div className="card stack">
              <h2>{job.title}</h2>
              <div className="muted">{job.room ? `${job.room} · ` : ''}{job.category} · Urgenza: {URGENCY[job.urgency] || job.urgency}</div>
              {job.description && <p>{job.description}</p>}
              {closed && <p><strong>Intervento già chiuso dal personale. Grazie!</strong></p>}
            </div>
            {!closed && (
              <div className="card stack">
                <Button disabled={busy || has('arrival')} onClick={() => send('arrival')}>{has('arrival') ? 'Arrivo comunicato ✓' : 'Comunica quando arrivi'}</Button>
                <Button disabled={busy || has('started')} onClick={() => send('started')}>{has('started') ? 'Intervento iniziato ✓' : 'Inizia intervento'}</Button>
                <label className="stack"><span className="muted">Aggiungi una nota</span>
                  <textarea className="textarea" rows="3" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. serve un ricambio, torno domani…" /></label>
                <Button disabled={busy || !note.trim()} onClick={() => send('note', note)}>+ Aggiungi nota</Button>
                <Button variant="primary" disabled={busy || has('completion_requested')} onClick={() => send('completion_requested', note)}>
                  {has('completion_requested') ? 'Fine intervento comunicata ✓' : 'Intervento terminato · richiedi chiusura'}
                </Button>
                <div className="muted">Il personale controlla e chiude la segnalazione. Link valido fino al {formatDate(job.expires_at)}.</div>
              </div>
            )}
            {events.length > 0 && (
              <div className="card stack">
                <h2>Comunicato</h2>
                <ul className="timeline">
                  {events.map((e, i) => <li key={i}><span>{EVENT[e.kind] || e.kind}{e.note ? `: ${e.note}` : ''}</span><span className="muted"> · {formatDate(e.at)}</span></li>)}
                </ul>
              </div>
            )}
            <ErrorText>{error}</ErrorText>
          </div>
        )}
        {!job && !loading && !invalid && <ErrorText>{error}</ErrorText>}
      </div>
    </div>
  )
}
