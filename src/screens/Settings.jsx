import { useMemo, useState } from 'react'
import { HOTELS } from '../lib/hotels.js'
import { useAsync } from '../lib/hooks.js'
import { roleLabel } from '../lib/permissions.js'
import { ROLES, groupPermissions, rolesMatrix, permActionLabel, formatBytes, isValidPin, deliverySummary, CHANNEL_LABELS } from '../lib/admin.js'
import * as api from '../data/admin.js'
import { adminSetPhone } from '../data/profile.js'
import { aiStats, aiTrainingExport } from '../data/ai.js'
import { localShare, toJsonl } from '../lib/ai.js'
import { Button, ErrorText, Spinner, formatDate } from '../ui/kit.jsx'

const TABS = [
  { id: 'users', label: 'Utenti' },
  { id: 'roles', label: 'Ruoli' },
  { id: 'notify', label: 'Notifiche' },
  { id: 'ai', label: 'IA' },
  { id: 'usage', label: 'Consumi' },
  { id: 'diag', label: 'Diagnostica' },
]

const shown = (p) => (p ? p.replace(/^\+39(\d{3})(\d{3})(\d+)$/, '+39 $1 $2 $3') : '')

// ------------------------------------------------------------------ Utenti
function NewUser({ ctx, onDone }) {
  const [f, setF] = useState({ name: '', role: 'manutentore', pin: '', phone: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async (e) => {
    e.preventDefault()
    setErr('')
    if (f.name.trim().length < 2) return setErr('Scrivi il nome')
    if (!isValidPin(f.pin)) return setErr('Il PIN deve avere 4 cifre')
    setBusy(true)
    try {
      const { user_id: id } = await api.createUser(ctx.hotelId, { name: f.name.trim(), role: f.role, pin: f.pin })
      if (f.phone.trim()) {
        try { await adminSetPhone(ctx.hotelId, id, f.phone) } catch (pe) { setErr(`Utente creato, ma il numero no: ${pe.message}`); onDone(true); return }
      }
      onDone()
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="card stack" onSubmit={save} autoComplete="off">
      <h2>Nuovo utente</h2>
      <input className="input" placeholder="Nome e cognome" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Nome" />
      <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} aria-label="Ruolo">
        {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
      </select>
      <input className="input" inputMode="numeric" type="password" maxLength={4} placeholder="PIN di 4 cifre" value={f.pin}
        onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} aria-label="PIN" autoComplete="new-password" />
      <input className="input" inputMode="tel" placeholder="Numero WhatsApp (facoltativo)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} aria-label="Numero WhatsApp" />
      <ErrorText>{err}</ErrorText>
      <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Salvo…' : 'Crea utente'}</Button>
    </form>
  )
}

function UserRow({ ctx, u, onChanged }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: u.name, role: u.role, active: u.active, phone: u.phone || '' })
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const self = u.auth_user_id === ctx.userId
  const run = async (fn, ok) => {
    setBusy(true); setErr(''); setMsg('')
    try { await fn(); setMsg(ok); onChanged() } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const save = () => run(async () => {
    await api.updateUser(ctx.hotelId, u.auth_user_id, f)
    if (f.phone !== (u.phone || '')) setF({ ...f, phone: await adminSetPhone(ctx.hotelId, u.auth_user_id, f.phone) })
  }, 'Salvato')
  return (
    <div className="card stack" data-testid="user-row">
      <button type="button" className="row" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <strong>{u.name}{self ? ' (tu)' : ''}</strong>
        <span className="muted">{roleLabel(u.role)}{u.active ? '' : ' · disattivato'}{u.locked ? ' · bloccato' : ''}{u.phone ? '' : ' · senza WhatsApp'}</span>
      </button>
      {open && (
        <div className="stack">
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Nome" />
          <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} aria-label="Ruolo">
            {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
          <input className="input" inputMode="tel" placeholder="Numero WhatsApp" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} aria-label="Numero WhatsApp" />
          {u.phone && <span className="muted">Ora: {shown(u.phone)}</span>}
          <label className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
            <input type="checkbox" checked={f.active} disabled={self} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Attivo
          </label>
          <Button variant="primary" onClick={save} disabled={busy}>Salva</Button>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" inputMode="numeric" type="password" maxLength={4} placeholder="Nuovo PIN (4 cifre)" value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} aria-label="Nuovo PIN" autoComplete="new-password" />
            <Button disabled={busy || !isValidPin(pin)} onClick={() => run(async () => { await api.resetPin(ctx.hotelId, u.auth_user_id, pin); setPin('') }, 'PIN cambiato e utente sbloccato')}>Cambia PIN</Button>
          </div>
          {u.locked && <Button disabled={busy} onClick={() => run(() => api.unlockUser(ctx.hotelId, u.auth_user_id), 'Sbloccato')}>Sblocca (troppi tentativi)</Button>}
          {msg && <p role="status">{msg}</p>}
          <ErrorText>{err}</ErrorText>
        </div>
      )}
    </div>
  )
}

function UsersTab({ ctx }) {
  const { data, error, loading, reload } = useAsync(() => api.listUsers(ctx.hotelId), [ctx.hotelId])
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const rows = useMemo(() => (data || []).filter((u) => u.name.toLowerCase().includes(q.trim().toLowerCase())), [data, q])
  const noPhone = (data || []).filter((u) => u.active && !u.phone).length
  return (
    <div className="stack">
      <div className="row" style={{ gap: 8 }}>
        <input className="input" placeholder="Cerca utente…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca utente" />
        <Button onClick={() => setCreating((v) => !v)}>{creating ? 'Chiudi' : '+ Nuovo'}</Button>
      </div>
      {creating && <NewUser ctx={ctx} onDone={(keepOpen) => { if (!keepOpen) setCreating(false); reload() }} />}
      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      {data && <div className="card"><strong>{data.filter((u) => u.active).length}</strong> utenti attivi · <strong>{noPhone}</strong> senza numero WhatsApp</div>}
      {rows.map((u) => <UserRow key={u.auth_user_id} ctx={ctx} u={u} onChanged={reload} />)}
    </div>
  )
}

// ------------------------------------------------------------------ Ruoli
function RolesTab({ ctx }) {
  const { data, error, loading, reload } = useAsync(() => api.rolesOverview(ctx.hotelId), [ctx.hotelId])
  const [role, setRole] = useState('manutentore')
  const [err, setErr] = useState('')
  const matrix = useMemo(() => rolesMatrix(data), [data])
  const groups = useMemo(() => groupPermissions((data || []).map((r) => r.permission)), [data])
  const toggle = async (perm, on) => {
    setErr('')
    try { await api.setRolePermission(ctx.hotelId, role, perm, on); reload() } catch (e) { setErr(e.message) }
  }
  return (
    <div className="stack">
      <p className="muted">I permessi di un ruolo valgono per <strong>tutte le strutture</strong>. Si applicano al prossimo accesso.</p>
      <div className="chips" role="group" aria-label="Ruolo">
        {ROLES.map((r) => <button key={r} className="chip" aria-pressed={role === r} onClick={() => setRole(r)}>{roleLabel(r)}</button>)}
      </div>
      {loading && !data && <Spinner />}
      <ErrorText>{error || err}</ErrorText>
      {groups.map((g) => (
        <div key={g.group} className="card stack">
          <strong>{g.label}</strong>
          {g.perms.map((p) => (
            <label key={p} className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
              <input type="checkbox" checked={matrix[role]?.has(p) || false} disabled={role === 'admin' && p === 'admin.access'} onChange={(e) => toggle(p, e.target.checked)} />
              <span>Può {permActionLabel(p)}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ Notifiche (WhatsApp, ntfy, push)
function NotifyTab({ ctx }) {
  const { data, error, loading, reload } = useAsync(() => api.notificationOverview(ctx.hotelId), [ctx.hotelId])
  const [err, setErr] = useState('')
  const sums = deliverySummary(data?.deliveries)
  const toggle = async (channel, enabled) => {
    setErr('')
    try { await api.setChannelEnabled(ctx.hotelId, channel, enabled); reload() } catch (e) { setErr(e.message) }
  }
  return (
    <div className="stack">
      {loading && !data && <Spinner />}
      <ErrorText>{error || err}</ErrorText>
      {data && (
        <>
          <div className="card stack">
            <h2>WhatsApp</h2>
            <span>{data.people_with_phone} persone su {data.people} hanno il numero.</span>
            {data.people_with_phone < data.people && <span className="muted">Aggiungi i numeri mancanti dalla scheda Utenti.</span>}
          </div>
          {['whatsapp', 'ntfy', 'push'].map((c) => {
            const ch = (data.channels || []).find((x) => x.channel === c)
            const s = sums[c] || {}
            return (
              <div key={c} className="card stack">
                <label className="row">
                  <strong>{CHANNEL_LABELS[c]}</strong>
                  <input type="checkbox" checked={!!ch?.enabled} onChange={(e) => toggle(c, e.target.checked)} aria-label={`${CHANNEL_LABELS[c]} attivo`} />
                </label>
                <span className="muted">Ultimi 7 giorni: {s.sent || 0} inviati · {s.failed || 0} falliti · {s.skipped || 0} saltati · {s.pending || 0} in coda</span>
              </div>
            )
          })}
          <div className="card stack">
            <strong>Destinazioni registrate</strong>
            {(data.devices || []).length === 0 && <span className="muted">Nessuna.</span>}
            {(data.devices || []).map((d) => <span key={d.platform}>{d.platform}: {d.n}</span>)}
          </div>
          <div className="card stack">
            <strong>Ultimi invii falliti</strong>
            {(data.failed || []).length === 0 && <span className="muted">Nessuno.</span>}
            {(data.failed || []).map((f, i) => <span key={i}>{formatDate(f.at)} · {CHANNEL_LABELS[f.channel] || f.channel} · {f.error || 'errore'}</span>)}
          </div>
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ IA (registro delle scelte, per il modello locale futuro)
const SOURCE_LABELS = { rules: 'Regole', history: 'Storico', human: 'Scelte delle persone', local: 'Modello locale', cloud: 'Modello cloud' }

function AiTab({ ctx }) {
  const { data, error, loading } = useAsync(() => aiStats(ctx.hotelId), [ctx.hotelId])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const download = async () => {
    setBusy(true); setErr('')
    try {
      const rows = await aiTrainingExport(ctx.hotelId)
      const url = URL.createObjectURL(new Blob([toJsonl(rows)], { type: 'application/x-ndjson' }))
      const a = document.createElement('a')
      a.href = url; a.download = `randapp-esempi-${ctx.hotelId}-${new Date().toISOString().slice(0, 10)}.jsonl`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const share = data ? localShare(data.by_source) : null
  return (
    <div className="stack">
      <p className="muted">Ogni "Casi simili" mostrato, ogni giudizio e ogni scelta fatta scrivendo una segnalazione viene registrato (senza numeri né email). Sono gli esempi per allenare, più avanti, un modello locale.</p>
      {loading && !data && <Spinner />}
      <ErrorText>{error || err}</ErrorText>
      {data && (
        <>
          <div className="card row"><span>Richieste registrate (totale)</span><strong>{data.total}</strong></div>
          <div className="card row"><span>Esempi già verificati</span><strong>{data.verified}</strong></div>
          <div className="card row"><span>Casi chiusi nello storico (utilizzabili)</span><strong>{data.history_labeled}</strong></div>
          <div className="card stack">
            <strong>Da dove arrivano le risposte (30 giorni)</strong>
            {Object.keys(data.by_source || {}).length === 0 && <span className="muted">Ancora nessuna richiesta.</span>}
            {Object.entries(data.by_source || {}).map(([k, v]) => <span key={k}>{SOURCE_LABELS[k] || k}: {v}</span>)}
            <span className="muted">Quota locale sui modelli usati: {share === null ? 'nessun modello ancora in uso' : `${Math.round(share * 100)}%`}</span>
          </div>
          <div className="card stack">
            <strong>Giudizi</strong>
            <span>Utili: {data.feedback?.up || 0} · Non utili: {data.feedback?.down || 0} · Corretti: {data.feedback?.corrected || 0}</span>
          </div>
        </>
      )}
      <Button onClick={download} disabled={busy}>{busy ? 'Preparo…' : 'Scarica esempi verificati (.jsonl)'}</Button>
    </div>
  )
}

// ------------------------------------------------------------------ Consumi
function UsageTab({ ctx }) {
  const { data, error, loading } = useAsync(() => api.usage(ctx.hotelId), [ctx.hotelId])
  const items = data && [
    ['Utenti attivi', data.users], ['Segnalazioni', `${data.issues} (${data.issues_open} aperte)`], ['Interventi', data.interventions],
    ['Planning lavori', data.planning_works], ['Prenotazioni sale', data.sale_bookings], ['Urgenti', data.urgent],
    ['Foto', `${data.photos} (${formatBytes(data.photos_bytes)})`], ['Database', formatBytes(data.db_bytes)], ['Connessioni database', data.connections],
  ]
  return (
    <div className="stack">
      {loading && !data && <Spinner />}
      <ErrorText>{error}</ErrorText>
      {items && items.map(([k, v]) => <div key={k} className="card row"><span>{k}</span><strong>{v}</strong></div>)}
      <p className="muted">Il database è condiviso con la vecchia app; le foto e i conteggi sono della struttura scelta.</p>
    </div>
  )
}

// ------------------------------------------------------------------ Diagnostica
function DiagTab({ ctx }) {
  const u = useAsync(() => api.usage(ctx.hotelId), [ctx.hotelId])
  const n = useAsync(() => api.notificationOverview(ctx.hotelId), [ctx.hotelId])
  const failed = (n.data?.failed || []).length
  return (
    <div className="stack">
      <div className="card stack">
        <strong>Errori ultimi 7 giorni: {u.data ? u.data.errors_7d : '…'}</strong>
        <span className="muted">Il registro dice la causa: app, utente o dispositivo.</span>
        <a className="btn" href="#/errors">Apri registro errori</a>
      </div>
      <div className="card stack">
        <strong>Invii notifiche falliti: {n.data ? failed : '…'}</strong>
        <span className="muted">Dettagli nella scheda Notifiche.</span>
      </div>
      <div className="card stack">
        <strong>Telefoni e collegamento</strong>
        <a className="btn" href="#/phones">Numeri WhatsApp non assegnati</a>
      </div>
      <ErrorText>{u.error || n.error}</ErrorText>
    </div>
  )
}

export default function Settings({ ctx }) {
  const [tab, setTab] = useState('users')
  const hotel = HOTELS.find((h) => h.id === ctx.hotelId)
  const Tab = { users: UsersTab, roles: RolesTab, notify: NotifyTab, ai: AiTab, usage: UsageTab, diag: DiagTab }[tab]
  return (
    <div className="page">
      <a href="#/profile">← Profilo</a>
      <h1>Impostazioni</h1>
      <p className="muted">Gestione di {hotel?.name || ctx.hotelId}: utenti, ruoli, notifiche, consumi e diagnostica.</p>
      <div className="chips" role="tablist" aria-label="Sezioni impostazioni">
        {TABS.map((t) => <button key={t.id} role="tab" className="chip" aria-selected={tab === t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      <Tab ctx={ctx} />
    </div>
  )
}
