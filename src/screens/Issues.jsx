import { useEffect, useState } from 'react'
import { listIssues, getIssue, updateIssueStatus, listIssuePhotos, addIssuePhoto, saveIssueWork, assignTechnician, requestPart, partArrived, updateIssueDetails } from '../data/issues.js'
import { listInterventionsForIssue } from '../data/interventions.js'
import IssueThumb from '../ui/IssueThumb.jsx'
import SimilarCases from '../ui/SimilarCases.jsx'
import { queryFrom } from '../lib/ai.js'
import { compressPhotoAsDataUrl } from '../lib/photo.js'
import { useAsync, go, usePending } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import { listTechnicians } from '../data/technicians.js'
import { createTechnicianLink, technicianLinkUrl, listTechnicianEvents } from '../data/technician-links.js'
import { technicianWaLink } from '../lib/technician-wa.js'
import { issueTimeline } from '../lib/issue-timeline.js'
import { STATUSES, CATEGORIES, URGENCIES, filterByStatus, sortByPriority } from '../lib/queue.js'
import { StatRow } from '../ui/hub.jsx'
import { issueStats } from '../lib/queue.js'
import { todayIso } from '../lib/planning.js'
import { Badge, Button, Icon, ErrorText, Spinner, UrgencyBadge, StatusBadge, formatDate } from '../ui/kit.jsx'

export function IssueList({ ctx }) {
  const [status, setStatus] = useState('da_fare')
  const { data, error, loading, reload } = useAsync(() => listIssues(ctx.hotelId), [ctx.hotelId])

  const visible = sortByPriority(filterByStatus(data || [], status))
  // Segnalazioni scritte senza rete e non ancora arrivate al server (nuove, quindi «da fare»).
  const waiting = usePending(ctx).filter((e) => e.kind === 'issue.create' && e.hotelId === ctx.hotelId && e.status === 'pending')
    .map((e) => e.payload.row).filter(() => status === 'da_fare' || status === 'tutte')

  return (
    <div className="page">
      <div className="row">
        <h1>Segnalazioni</h1>
        {can(ctx.permissions, PERM.ISSUES_CREATE) && (
          <Button variant="primary" onClick={() => go('/issues/new')}>+ Nuova</Button>
        )}
      </div>

      {data && (() => { const st = issueStats(data, todayIso()); return <StatRow stats={[{ value: st.open, label: 'Aperte' }, { value: st.urgent, label: 'Urgenti', tone: 'warn' }, { value: st.done, label: 'Fatte oggi', tone: 'ok' }]} /> })()}

      <div className="chips" role="group" aria-label="Filtro stato">
        {[...STATUSES, { id: 'tutte', label: 'Tutte' }].map((s) => (
          <button key={s.id} className="chip" aria-pressed={status === s.id} onClick={() => setStatus(s.id)}>
            {s.label}{data ? ` ${filterByStatus(data, s.id).length}` : ''}
          </button>
        ))}
      </div>

      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      {error && <Button onClick={reload}>Riprova</Button>}

      <div className="list">
        {waiting.map((row) => (
          <div key={row.id} className="card issue">
            <div className="row">
              <span className="title">{row.title}</span>
              <UrgencyBadge urgency={row.urgency} />
            </div>
            <div className="row muted">
              <span>{row.room ? `Camera/zona ${row.room} · ` : ''}{row.category}</span>
              <Badge kind="in_corso">In attesa di invio</Badge>
            </div>
          </div>
        ))}
        {visible.map((issue) => (
          <a key={issue.id} className={`card issue${issue.photo_count ? ' has-thumb' : ''}`} href={`#/issues/${issue.id}`}>
            <div className="issue-main">
              <div className="row">
                <span className="title">{issue.title}</span>
                <UrgencyBadge urgency={issue.urgency} />
              </div>
              <div className="row muted">
                <span>{issue.room ? `Camera/zona ${issue.room} · ` : ''}{issue.category}</span>
                <span><StatusBadge status={issue.status} /> {formatDate(issue.created_at)}</span>
              </div>
            </div>
            {issue.photo_count > 0 && <IssueThumb hotelId={ctx.hotelId} issueId={issue.id} />}
          </a>
        ))}
        {data && visible.length === 0 && waiting.length === 0 && <div className="card muted">Nessuna segnalazione in questo stato.</div>}
      </div>
    </div>
  )
}

// Anteprima piccola; un tocco la apre a tutto schermo (si chiude con un tocco, ×, o Esc).
function IssuePhoto({ src, alt }) {
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!open) return undefined
    const close = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [open])
  if (!src || failed) return <div className="photo-missing muted">Foto non disponibile</div>
  return (
    <>
      <button type="button" className="photo-thumb" onClick={() => setOpen(true)} aria-label={`Ingrandisci: ${alt}`}>
        <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
        <span className="photo-hint">Tocca per ingrandire</span>
      </button>
      {open && (
        <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setOpen(false)}>
          <button type="button" className="photo-lightbox-close" onClick={() => setOpen(false)} aria-label="Chiudi foto">×</button>
          <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}

// Una casella della coppia Prima | Dopo: foto con ingrandimento, oppure «+ Aggiungi» (scatta o scegli).
function PhotoSlot({ kind, photo, loaded, canAdd, hotelId, issueId, onAdded }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const label = kind === 'prima' ? 'Prima' : 'Dopo'
  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      await addIssuePhoto(hotelId, issueId, kind, await compressPhotoAsDataUrl(file))
      await onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <figure className="photo-fig">
      {photo ? (
        <IssuePhoto src={photo.data_url} alt={kind === 'prima' ? 'Foto del problema' : 'Foto dopo l\'intervento'} />
      ) : loaded && canAdd ? (
        <label className="photo-add">
          <input type="file" accept="image/*" hidden disabled={busy} onChange={pick} />
          <Icon name="camera" size={24} />
          <span>{busy ? 'Salvo…' : `+ Foto ${label.toLowerCase()}`}</span>
        </label>
      ) : (
        <div className="photo-missing muted">{loaded ? 'Nessuna foto' : '…'}</div>
      )}
      <figcaption className="muted">{label}</figcaption>
      <ErrorText>{error}</ErrorText>
    </figure>
  )
}

// Note sul lavoro fatto, pezzo sostituito, tecnico + «Riparazione completata» (come l'app HotelGio).
function WorkCard({ issue, ctx, onSaved }) {
  const [note, setNote] = useState(issue.completion_note || '')
  const [part, setPart] = useState(issue.part_replaced || '')
  const [tech, setTech] = useState(issue.technician_name || '')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const run = async (complete) => {
    setBusy(complete ? 'complete' : 'save')
    setError('')
    setSaved(false)
    try {
      await saveIssueWork(ctx.hotelId, issue.id, { note, part, technician: tech, complete, closerName: ctx.name })
      await onSaved()
      setSaved(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }
  return (
    <div className="card stack">
      <h2>Lavoro svolto</h2>
      <label className="stack">
        <span className="muted">Note sul lavoro fatto</span>
        <textarea className="textarea" rows="3" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cosa è stato fatto" />
      </label>
      <label className="stack">
        <span className="muted">Pezzo sostituito</span>
        <input className="input" maxLength={200} value={part} onChange={(e) => setPart(e.target.value)} placeholder="Es. Lampadina LED bagno" />
      </label>
      <label className="stack">
        <span className="muted">Tecnico (se è intervenuto)</span>
        <input className="input" maxLength={120} value={tech} onChange={(e) => setTech(e.target.value)} placeholder="Nome del tecnico" />
      </label>
      <div className="row">
        <Button disabled={!!busy} onClick={() => run(false)}>{busy === 'save' ? 'Salvo…' : 'Salva note'}</Button>
        <Button variant="primary" disabled={!!busy} onClick={() => run(true)}>{busy === 'complete' ? 'Salvo…' : 'Riparazione completata'}</Button>
      </div>
      {saved && <div className="muted">Salvato.</div>}
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

// «Assegna tecnico» dall'elenco Tecnici + messaggio WhatsApp con la nota (come HotelGio).
function TechnicianCard({ issue, ctx, onSaved }) {
  const { data: techs } = useAsync(() => listTechnicians(ctx.hotelId), [ctx.hotelId])
  const [choice, setChoice] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = (techs || []).filter((t) => t.active)
  const current = (techs || []).find((t) => t.id === issue.technician_id)
  const assign = async () => {
    const t = active.find((x) => x.id === choice)
    if (!t) return
    setBusy(true)
    setError('')
    try { await assignTechnician(ctx.hotelId, issue.id, t); await onSaved(); setChoice('') } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const [portalUrl, setPortalUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const makeLink = async () => {
    setBusy(true)
    setError('')
    try { setPortalUrl(technicianLinkUrl(await createTechnicianLink(ctx.hotelId, issue.id, current.id))) } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(portalUrl); setCopied(true) } catch { setError('Copia non riuscita: seleziona il link e copialo a mano') }
  }
  const link = current ? technicianWaLink(issue, current, note, portalUrl) : null
  return (
    <div className="card stack">
      <h2>Tecnico</h2>
      {issue.technician_name && <div>{issue.technician_name}{current?.company ? ` · ${current.company}` : ''}</div>}
      {current && (
        <>
          <label className="stack"><span className="muted">Nota per il tecnico (facoltativa)</span>
            <textarea className="textarea" rows="2" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Aggiungi dettagli per il tecnico" /></label>
          {!portalUrl && <Button disabled={busy} onClick={makeLink}>{busy ? 'Creo…' : 'Crea link per la chiusura'}</Button>}
          {portalUrl && (
            <div className="stack">
              <div className="muted">Link personale per il tecnico (72 ore). Un nuovo link annulla il precedente.</div>
              <input className="input" readOnly value={portalUrl} onFocus={(e) => e.target.select()} aria-label="Link per il tecnico" />
              <Button onClick={copy}>{copied ? 'Copiato' : 'Copia link'}</Button>
            </div>
          )}
          {link && <a className="btn primary" href={link} target="_blank" rel="noopener noreferrer">Apri WhatsApp{portalUrl ? ' con il link' : ''}</a>}
        </>
      )}
      <label className="stack"><span className="muted">{current ? 'Cambia tecnico' : 'Quale tecnico esterno?'}</span>
        <select className="select" value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">Scegli…</option>
          {active.map((t) => <option key={t.id} value={t.id}>{t.name}{t.company ? ` · ${t.company}` : ''}</option>)}
        </select></label>
      {techs && active.length === 0 && <div className="muted">Nessun tecnico attivo per questa struttura: aggiungilo dalla sezione Tecnici.</div>}
      <Button disabled={busy || !choice} onClick={assign}>{busy ? 'Salvo…' : 'Assegna tecnico'}</Button>
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

// «Serve pezzo» / «Pezzo arrivato» (come HotelGio).
function PartCard({ issue, ctx, onSaved }) {
  const [part, setPart] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (fn) => {
    setBusy(true)
    setError('')
    try { await fn(); await onSaved(); setPart('') } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  if (issue.status === 'attesa_pezzo') {
    return (
      <div className="card stack">
        <h2>In attesa del pezzo</h2>
        {issue.part_needed && <div>{issue.part_needed}</div>}
        <Button variant="primary" disabled={busy} onClick={() => run(() => partArrived(ctx.hotelId, issue.id))}>{busy ? 'Salvo…' : 'Pezzo arrivato'}</Button>
        <ErrorText>{error}</ErrorText>
      </div>
    )
  }
  if (issue.status !== 'da_fare') return null
  return (
    <div className="card stack">
      <h2>Serve un pezzo?</h2>
      <input className="input" maxLength={200} value={part} onChange={(e) => setPart(e.target.value)} placeholder="Es. Faretto LED IP65" />
      <Button disabled={busy || !part.trim()} onClick={() => run(() => requestPart(ctx.hotelId, issue.id, part))}>{busy ? 'Salvo…' : 'Serve pezzo'}</Button>
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

// Modifica di camera/zona, descrizione, urgenza e categoria.
function DetailsEditor({ issue, ctx, onClose, onSaved }) {
  const [draft, setDraft] = useState({ room: issue.room || '', title: issue.title || '', urgency: issue.urgency, category: issue.category })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async () => {
    setBusy(true)
    setError('')
    try { await updateIssueDetails(ctx.hotelId, issue.id, draft); await onSaved(); onClose() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="card stack">
      <h2>Modifica</h2>
      <label className="stack"><span className="muted">Camera o zona</span>
        <input className="input" maxLength={60} value={draft.room} onChange={(e) => setDraft({ ...draft, room: e.target.value })} /></label>
      <label className="stack"><span className="muted">Descrizione</span>
        <textarea className="textarea" rows="3" maxLength={140} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
      <div className="stack"><span className="muted">Urgenza</span>
        <div className="chips">{URGENCIES.map((u) => <button type="button" key={u.id} className="chip" aria-pressed={draft.urgency === u.id} onClick={() => setDraft({ ...draft, urgency: u.id })}>{u.label}</button>)}</div></div>
      <div className="stack"><span className="muted">Categoria</span>
        <div className="chips">{CATEGORIES.map((c) => <button type="button" key={c} className="chip" aria-pressed={draft.category === c} onClick={() => setDraft({ ...draft, category: c })}>{c}</button>)}</div></div>
      <div className="row">
        <Button disabled={busy} onClick={onClose}>Annulla</Button>
        <Button variant="primary" disabled={busy || !draft.title.trim()} onClick={save}>{busy ? 'Salvo…' : 'Salva modifiche'}</Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

function Timeline({ issue, techEvents }) {
  const events = issueTimeline(issue, techEvents)
  return (
    <div className="card stack">
      <h2>Cronologia</h2>
      <ul className="timeline">
        {events.map((e) => (
          <li key={e.id}><span>{e.text}</span>{e.at && <span className="muted"> · {formatDate(e.at)}</span>}</li>
        ))}
      </ul>
    </div>
  )
}

export function IssueDetail({ ctx, id }) {
  const { data: issue, error, loading, reload } = useAsync(() => getIssue(ctx.hotelId, id), [ctx.hotelId, id])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [editing, setEditing] = useState(false)
  const canUpdate = can(ctx.permissions, PERM.ISSUES_UPDATE)
  const canMakeIntervention = can(ctx.permissions, PERM.INTERVENTIONS_CREATE)
  const { data: linked } = useAsync(() => listInterventionsForIssue(ctx.hotelId, id), [ctx.hotelId, id])
  const { data: techEvents } = useAsync(() => listTechnicianEvents(ctx.hotelId, id).catch(() => []), [ctx.hotelId, id])
  const { data: photos, reload: reloadPhotos } = useAsync(() => listIssuePhotos(ctx.hotelId, id), [ctx.hotelId, id])

  const change = async (status) => {
    setBusy(true)
    setActionError('')
    try {
      await updateIssueStatus(ctx.hotelId, id, status, ctx.name)
      await reload()
    } catch (e) {
      setActionError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading && !issue) return <Spinner />
  if (error) return <div className="page"><ErrorText>{error}</ErrorText></div>
  if (!issue) return <div className="page"><p className="muted">Segnalazione non trovata.</p></div>

  return (
    <div className="page">
      <a href="#/issues">← Segnalazioni</a>
      <div className="card stack">
        <div className="row">
          <h1>{issue.title}</h1>
          <UrgencyBadge urgency={issue.urgency} />
        </div>
        <div className="muted">
          {issue.room ? `Camera/zona ${issue.room} · ` : ''}{issue.category} · aperta il {formatDate(issue.created_at)}
          {issue.created_by_name ? ` da ${issue.created_by_name}` : ''}
        </div>
        {issue.description && <p>{issue.description}</p>}
        <div className="row">
          <StatusBadge status={issue.status} />
          {canUpdate && !editing && <Button onClick={() => setEditing(true)}>Modifica</Button>}
        </div>
        {issue.part_needed && issue.status === 'attesa_pezzo' && <div className="muted">Pezzo in attesa: {issue.part_needed}</div>}
      </div>

      {issue.status !== 'completata' && (techEvents || []).some((e) => e.kind === 'completion_requested') && (
        <div className="card" role="status"><strong>Il tecnico ha comunicato la fine dell'intervento.</strong> Controlla e chiudi la segnalazione con «Lavoro svolto».</div>
      )}

      {editing && <DetailsEditor issue={issue} ctx={ctx} onClose={() => setEditing(false)} onSaved={reload} />}

      {issue.status !== 'completata' && <SimilarCases ctx={ctx} query={queryFrom(issue)} exclude={issue.id} />}

      {canUpdate && can(ctx.permissions, PERM.TECHNICIANS_VIEW) && issue.status !== 'completata' && <TechnicianCard key={`t${issue.id}${issue.technician_id}`} issue={issue} ctx={ctx} onSaved={reload} />}

      {canUpdate && <PartCard key={`p${issue.id}${issue.status}`} issue={issue} ctx={ctx} onSaved={reload} />}

      {canUpdate && issue.status !== 'completata' && <WorkCard key={issue.id} issue={issue} ctx={ctx} onSaved={reload} />}

      {(issue.completion_note || issue.technician_name || issue.part_replaced || (issue.completed_at && issue.completed_by_name)) && (
        <div className="card stack">
          <h2>Intervento</h2>
          {issue.completed_at && (
            <div className="muted">Chiusa il {formatDate(issue.completed_at)}{issue.completed_by_name ? ` da ${issue.completed_by_name}` : ''}</div>
          )}
          {issue.technician_name && <div>Tecnico: {issue.technician_name}</div>}
          {issue.part_replaced && <div>Pezzo sostituito: {issue.part_replaced}</div>}
          {issue.completion_note && <p>{issue.completion_note}</p>}
        </div>
      )}

      <Timeline issue={issue} techEvents={techEvents} />

      {(canUpdate || (photos && photos.length > 0)) && (
        <div className="card stack">
          <h2>Foto</h2>
          <div className="photo-pair">
            {['prima', 'dopo'].map((kind) => (
              <PhotoSlot key={kind} kind={kind} photo={(photos || []).find((f) => f.kind === kind)} loaded={!!photos}
                canAdd={canUpdate} hotelId={ctx.hotelId} issueId={id} onAdded={reloadPhotos} />
            ))}
          </div>
        </div>
      )}

      {((linked && linked.length > 0) || (canMakeIntervention && issue.status !== 'completata')) && (
        <div className="card stack">
          <h2>Interventi collegati</h2>
          {(linked || []).map((i) => (
            <a key={i.id} href={`#/interventions/${i.id}`}>{i.title} · {i.status.replace('_', ' ')}</a>
          ))}
          {canMakeIntervention && issue.status !== 'completata' && (
            <Button onClick={() => go(`/interventions/new/${issue.id}`)}>+ Crea intervento da questa segnalazione</Button>
          )}
        </div>
      )}

      {canUpdate && (
        <div className="card stack">
          <h2>Cambia stato</h2>
          <div className="chips">
            {STATUSES.map((s) => (
              <button key={s.id} className="chip" aria-pressed={issue.status === s.id}
                disabled={busy || issue.status === s.id} onClick={() => change(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          <ErrorText>{actionError}</ErrorText>
        </div>
      )}
    </div>
  )
}
