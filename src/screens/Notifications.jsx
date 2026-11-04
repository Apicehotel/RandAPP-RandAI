import { useState } from 'react'
import {
  currentWebToken, disableWebPush, enableWebPush, listChannels, listDevices, listNotifications, listPrefs,
  markAllRead, markRead, saveDevice, sendTest, setChannel, setDeviceActive, setPref, vapidKey,
} from '../data/notifications.js'
import { useAsync, go } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import {
  CHANNELS, groupByDay, hashFor, kindGroups, kindOf, newNtfyTopic, normalizePhone, ntfyLink, prefFor, timeOf, unreadCount, webPushSupported,
} from '../lib/notifications.js'
import { Button, ErrorText, Icon, Spinner } from '../ui/kit.jsx'

const changed = () => window.dispatchEvent(new Event('notifications:changed'))

// Casella delle notifiche: raggruppate per giorno, le non lette in evidenza.
export default function Notifications({ ctx }) {
  const { data, error, loading, reload } = useAsync(() => listNotifications(ctx.hotelId, ctx.userId), [ctx.hotelId, ctx.userId])
  const [err, setErr] = useState('')
  const unread = unreadCount(data)
  const open = async (n) => {
    if (!n.read_at) { try { await markRead(ctx.userId, [n.id]); changed() } catch { /* si apre lo stesso */ } }
  }
  const readAll = async () => {
    setErr('')
    try { await markAllRead(ctx.hotelId, ctx.userId); await reload(); changed() } catch (e) { setErr(e.message) }
  }

  return (
    <div className="page">
      <div className="row">
        <h1>Notifiche</h1>
        <a className="btn" href="#/notifications/settings">Impostazioni</a>
      </div>
      {unread > 0 && <Button onClick={readAll}>Segna tutte come lette ({unread})</Button>}
      <ErrorText>{error || err}</ErrorText>
      {error && <Button onClick={reload}>Riprova</Button>}
      {loading && !data && <Spinner />}
      {data && data.length === 0 && <div className="card muted">Nessuna notifica. Qui arrivano avvisi urgenti, assegnazioni, promemoria e allarmi dei sensori.</div>}
      {groupByDay(data || []).map((g) => (
        <section key={g.key} className="stack">
          <h2>{g.label}</h2>
          <div className="list">
            {g.items.map((n) => {
              const k = kindOf(n.kind)
              return (
                <a key={n.id} href={hashFor(n.link)} onClick={() => open(n)}
                  className={`card notif ${n.read_at ? 'read' : 'unread'}${n.priority === 'urgent' ? ' urgent' : ''}`}>
                  <div className="row"><strong>{n.title}</strong><span className="when">{timeOf(n.created_at)}</span></div>
                  {n.body && <span>{n.body}</span>}
                  <span className="when"><Icon name={k.icon} size={12} /> {k.label}</span>
                </a>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

// Dove e cosa ricevere: telefono, ntfy, WhatsApp, e per ogni tipo di notifica quali canali.
export function NotificationSettings({ ctx }) {
  const manage = can(ctx.permissions, PERM.NOTIFICATIONS_MANAGE)
  const state = useAsync(async () => {
    const [prefs, channels, devices, token] = await Promise.all([
      listPrefs(ctx.hotelId, ctx.userId), listChannels(ctx.hotelId), listDevices(ctx.hotelId, ctx.userId), currentWebToken().catch(() => null),
    ])
    return { prefs, channels, devices, token }
  }, [ctx.hotelId, ctx.userId])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [phone, setPhone] = useState('')
  const run = async (fn, ok = '') => {
    setBusy(true); setErr(''); setMsg('')
    try { await fn(); await state.reload(); if (ok) setMsg(ok); changed() } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const { prefs = [], channels = [], devices = [], token = null } = state.data || {}
  const hotelOn = (id) => channels.some((c) => c.channel === id && c.enabled)
  const mine = (platform) => devices.find((d) => d.platform === platform && d.active)
  const webHere = devices.find((d) => d.platform === 'web' && d.token === token && d.active)
  const ntfy = mine('ntfy')
  const wa = mine('whatsapp')

  return (
    <div className="page">
      <a href="#/notifications">← Notifiche</a>
      <h1>Impostazioni notifiche</h1>
      {state.loading && !state.data && <Spinner />}
      <ErrorText>{state.error || err}</ErrorText>
      {msg && <p className="ok-text">{msg}</p>}

      <div className="card stack">
        <strong>Questo telefono</strong>
        {!hotelOn('push') && <p className="muted">Le notifiche del telefono non sono ancora attive per la struttura.</p>}
        {!webPushSupported() ? (
          <p className="muted">Questo browser non le supporta. Su iPhone installa prima l'app sulla schermata Home.</p>
        ) : !vapidKey() ? (
          <p className="muted">Manca la chiave del server: l'amministratore deve completare la configurazione.</p>
        ) : webHere ? (
          <div className="row"><span className="ok-text">Attive su questo dispositivo</span>
            <Button disabled={busy} onClick={() => run(() => disableWebPush(webHere), 'Disattivate')}>Disattiva</Button></div>
        ) : (
          <Button variant="primary" disabled={busy} onClick={() => run(() => enableWebPush(ctx.hotelId, ctx.userId), 'Attive su questo dispositivo')}>Attiva su questo telefono</Button>
        )}
        <p className="muted">Quando ci sarà l'app Android o Apple, i telefoni si collegheranno qui allo stesso modo.</p>
      </div>

      <div className="card stack">
        <strong>ntfy</strong>
        {!hotelOn('ntfy') && <p className="muted">ntfy non è ancora attivo per la struttura.</p>}
        {ntfy ? (
          <>
            <p className="muted">Nell'app ntfy tocca "+" e scrivi questo nome (non condividerlo):</p>
            <div className="copybox">{ntfy.token}</div>
            <div className="row">
              <a href={ntfyLink(ntfy.token)} target="_blank" rel="noreferrer">Apri su ntfy</a>
              <Button disabled={busy} onClick={() => run(() => setDeviceActive(ntfy.id, false), 'ntfy disattivato')}>Disattiva</Button>
            </div>
          </>
        ) : (
          <Button disabled={busy} onClick={() => run(() => saveDevice({ hotelId: ctx.hotelId, userId: ctx.userId, platform: 'ntfy', token: newNtfyTopic(ctx.hotelId), label: 'ntfy' }), 'Topic creato')}>Attiva ntfy</Button>
        )}
      </div>

      <div className="card stack">
        <strong>WhatsApp</strong>
        {!hotelOn('whatsapp') && <p className="muted">WhatsApp non è ancora attivo per la struttura.</p>}
        {wa ? (
          <div className="row"><span>{wa.token}</span><Button disabled={busy} onClick={() => run(() => setDeviceActive(wa.id, false), 'Numero rimosso')}>Rimuovi</Button></div>
        ) : (
          <div className="row">
            <input className="input" inputMode="tel" placeholder="+39 333 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Numero WhatsApp" />
            <Button disabled={busy || !normalizePhone(phone)} onClick={() => run(() => saveDevice({ hotelId: ctx.hotelId, userId: ctx.userId, platform: 'whatsapp', token: normalizePhone(phone), label: 'WhatsApp' }), 'Numero salvato')}>Salva</Button>
          </div>
        )}
      </div>

      <div className="card stack">
        <strong>Cosa ricevere</strong>
        <p className="muted">In app le ricevi sempre. Qui scegli quali notifiche mandarti anche fuori dall'app.</p>
        {kindGroups().map((g) => (
          <div key={g.name} className="stack">
            <h2>{g.name}</h2>
            {g.kinds.map((k) => {
              const p = prefFor(prefs, k.id)
              return (
                <div key={k.id} className="kindrow">
                  <span>{k.label}{k.presentOnly && <small className="muted"> · solo se sei in struttura</small>}</span>
                  <div className="chips" role="group" aria-label={k.label}>
                    {CHANNELS.map((c) => (
                      <button key={c.id} type="button" className="chip" aria-pressed={p[c.id]} disabled={busy}
                        onClick={() => run(() => setPref(ctx.hotelId, ctx.userId, k.id, c.id, !p[c.id]))}>
                        {c.id === 'push' ? 'Tel.' : c.id === 'whatsapp' ? 'WA' : 'ntfy'}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {manage && (
        <div className="card stack">
          <strong>Canali della struttura</strong>
          <p className="muted">Accendi solo i canali già configurati sul server.</p>
          <div className="chips wrap">
            {CHANNELS.map((c) => (
              <button key={c.id} type="button" className="chip" aria-pressed={hotelOn(c.id)} disabled={busy}
                onClick={() => run(() => setChannel(ctx.hotelId, c.id, !hotelOn(c.id)))}>{c.label}</button>
            ))}
          </div>
          <Button disabled={busy} onClick={() => run(() => sendTest(ctx.hotelId), 'Notifica di prova inviata')}>Invia notifica di prova</Button>
        </div>
      )}
    </div>
  )
}
