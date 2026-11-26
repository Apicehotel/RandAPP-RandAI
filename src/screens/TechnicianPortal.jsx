import { useEffect, useState } from 'react'
import { getPortalJob, sendPortalEvent } from '../data/technician-links.js'
import { tokenFromPortalRoute } from '../lib/technician-portal.js'
import { apiceLogo } from '../lib/hotels.js'
import { formatArrival } from '../lib/issue-timeline.js'
import { toLocalInput } from '../lib/technician-portal.js'
import { Button, ErrorText, Spinner, formatDate } from '../ui/kit.jsx'

const URGENCY = { urgente: 'Urgente', alta: 'Alta', normale: 'Normale', bassa: 'Bassa' }
const EVENT = { arrival_set: 'Appuntamento fissato', started: 'Intervento iniziato', note: 'Nota', completion_requested: 'Intervento terminato' }


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
  const [editingArrival, setEditingArrival] = useState(false)
  const [arrival, setArrival] = useState('')
  const [confirm, setConfirm] = useState('')

  useEffect(() => {
    if (!token) { setInvalid(true); setLoading(false); return }
    getPortalJob(token)
      .then(setJob)
      .catch((e) => { if (e.status === 404) setInvalid(true); else setError(e.message) })
      .finally(() => setLoading(false))
  }, [token])

  const send = async (kind, text = '', arrivalAt = null) => {
    setBusy(true)
    setError('')
    try {
      const next = await sendPortalEvent(token, kind, text, arrivalAt)
      if (next) setJob(next)
      if (kind === 'note') setNote('')
      if (kind === 'arrival_set') setEditingArrival(false)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const events = job?.events || []
  const appt = job?.appointment_at
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
                {appt && !editingArrival && <p>🚚 Appuntamento: <strong>{formatArrival(appt)}</strong></p>}
                {editingArrival ? (
                  <div className="stack">
                    <label className="stack"><span className="muted">Quando pensi di arrivare?</span>
                      <input className="input" name="arrival" autoComplete="off" type="datetime-local" value={arrival} onChange={(e) => setArrival(e.target.value)} /></label>
                    <div className="row">
                      <Button disabled={busy} onClick={() => setEditingArrival(false)}>Annulla</Button>
                      <Button variant="primary" disabled={busy || !arrival} onClick={() => send('arrival_set', '', new Date(arrival).toISOString())}>Salva orario</Button>
                    </div>
                  </div>
                ) : (
                  appt && confirm === 'change' ? (
                    <div className="stack" role="alertdialog">
                      <strong>Sei sicuro di voler modificare l'appuntamento di {formatArrival(appt)}?</strong>
                      <div className="row">
                        <Button onClick={() => setConfirm('')}>No, lascia</Button>
                        <Button variant="primary" onClick={() => { setConfirm(''); setArrival(toLocalInput(appt)); setEditingArrival(true) }}>Sì, modifica</Button>
                      </div>
                    </div>
                  ) : (
                    <Button disabled={busy} onClick={() => { if (appt) setConfirm('change'); else { setArrival(''); setEditingArrival(true) } }}>{appt ? 'Cambia orario di arrivo' : 'Comunica quando arrivi'}</Button>
                  )
                )}
                <Button disabled={busy || has('started')} onClick={() => send('started')}>{has('started') ? 'Intervento iniziato ✓' : 'Inizia intervento'}</Button>
                <label className="stack"><span className="muted">Aggiungi una nota</span>
                  <textarea className="textarea" rows="3" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. serve un ricambio, torno domani…" /></label>
                <Button disabled={busy || !note.trim()} onClick={() => send('note', note)}>+ Aggiungi nota</Button>
                {confirm === 'done' ? (
                  <div className="stack" role="alertdialog">
                    <strong>Sei sicuro che l'intervento è terminato? Il personale riceverà la richiesta di chiusura.</strong>
                    <div className="row">
                      <Button onClick={() => setConfirm('')}>No, non ancora</Button>
                      <Button variant="primary" disabled={busy} onClick={() => { setConfirm(''); send('completion_requested', note) }}>Sì, terminato</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="primary" disabled={busy || has('completion_requested')} onClick={() => setConfirm('done')}>
                    {has('completion_requested') ? 'Fine intervento comunicata ✓' : 'Intervento terminato · richiedi chiusura'}
                  </Button>
                )}
                <div className="muted">Il personale controlla e chiude la segnalazione. Link valido fino al {formatDate(job.expires_at)}; resta attivo fino alla chiusura del lavoro.</div>
              </div>
            )}
            {events.length > 0 && (
              <div className="card stack">
                <h2>Comunicato</h2>
                <ul className="timeline">
                  {events.map((e, i) => <li key={i}><span>{EVENT[e.kind] || e.kind}{e.kind === 'arrival_set' && e.arrival_at ? `: ${formatArrival(e.arrival_at)}` : ''}{e.note ? `: ${e.note}` : ''}</span><span className="muted"> · {formatDate(e.at)}</span></li>)}
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
