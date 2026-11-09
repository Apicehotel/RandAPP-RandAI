import { useState } from 'react'
import { getSettings, listSensors, refreshFromDevices, setSeason, updateSensor } from '../data/sensors.js'
import { useAsync, go } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import {
  DEFAULT_SETTINGS, SEASONS, STATE_LABELS, SWITCH_GROUPS, formatHumidity, formatTemp, groupSwitches, hiddenSensors,
  agoText, missingSensors, seasonLabel, sensorKindLabel, syncHealth, sensorState, sortSensors, summarizeSensors, switchLabel, temperatureSensors, thresholdsFor,
} from '../lib/sensors.js'
import { StatRow } from '../ui/hub.jsx'
import { Badge, Button, ErrorText, Icon, Spinner, formatDate } from '../ui/kit.jsx'

const BADGE = { ok: 'fatto', allerta: 'aperto', offline: 'alta' }
const GROUP_BADGE = { on: 'fatto', off: '', mixed: 'alta', unreachable: 'alta' }

const limitText = (t) => {
  const parts = []
  if (t.min !== null) parts.push(`sotto ${t.min}°C`)
  if (t.max !== null) parts.push(`sopra ${t.max}°C`)
  return parts.length ? `Allerta ${parts.join(' o ')}` : ''
}

export default function Sensors({ ctx }) {
  const { data, error, loading, reload } = useAsync(() => listSensors(ctx.hotelId), [ctx.hotelId])
  const settingsState = useAsync(() => getSettings(ctx.hotelId), [ctx.hotelId])
  const [tab, setTab] = useState('temperature')
  const [showHidden, setShowHidden] = useState(false)
  const [showMissing, setShowMissing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshNote, setRefreshNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const canManage = can(ctx.permissions, PERM.SENSORS_MANAGE)
  const settings = { ...DEFAULT_SETTINGS, ...(settingsState.data || {}) }
  const all = data || []
  const now = Date.now()
  const temps = sortSensors(temperatureSensors(all), now, settings)
  const groups = groupSwitches(all, now)
  const switchCount = groups.reduce((n, g) => n + g.items.length, 0)
  const sum = summarizeSensors(temperatureSensors(all), now, settings)
  const hidden = hiddenSensors(all)
  const missing = missingSensors(all.filter((x) => x.active !== false), now)
  const health = syncHealth(all, now)
  const newest = all.reduce((m, x) => (x.last_seen && (!m || x.last_seen > m) ? x.last_seen : m), null)

  const run = async (fn) => {
    setBusy(true); setActionError('')
    try { await fn() } catch (e) { setActionError(e.message) } finally { setBusy(false) }
  }
  const refresh = async () => {
    setRefreshing(true); setRefreshNote(''); setActionError('')
    try {
      const out = await refreshFromDevices(ctx.hotelId)
      await reload()
      setRefreshNote(out.throttled ? 'Dati già aggiornati un attimo fa' : `Aggiornati ${out.updated ?? 0} dispositivi su ${out.found ?? 0} rilevati da eWeLink${out.missing?.length ? ` · ${out.missing.length} non restituiti` : ''}${out.unmatched?.length ? ` · ${out.unmatched.length} da associare` : ''}`)
    } catch (e) {
      await reload().catch(() => {})
      setActionError(e.message)
    } finally { setRefreshing(false) }
  }
  const setActive = (id, active) => run(async () => { await updateSensor(ctx.hotelId, id, { active }); await reload() })
  const changeSeason = (season) => run(async () => { await setSeason(ctx.hotelId, ctx.userId, season); await settingsState.reload() })

  return (
    <div className="page">
      <div className="row">
        <h1>Sensori e impianti</h1>
        {canManage && <Button variant="primary" onClick={() => go('/sensors/new')}>+ Nuovo</Button>}
      </div>

      {data && all.some((item) => item.active !== false) && !newest && (
        <div className="banner" role="alert">Nessuna lettura disponibile per questa struttura. Verifica l'associazione dei dispositivi a eWeLink e usa Aggiorna.</div>
      )}
      {data && health.stopped && (
        <div className="banner" role="alert">Nessun sensore si aggiorna da {agoText(new Date(now - health.minutes * 60000).toISOString(), now).replace(' fa', '')}: la sincronizzazione sembra ferma.</div>
      )}

      {data && (
        <StatRow stats={[
          { value: sum.total, label: 'Sensori' },
          { value: sum.alert, label: 'In allerta', tone: sum.alert ? 'warn' : '' },
          { value: sum.offline, label: 'Non aggiornati', tone: sum.offline ? 'warn' : '' },
        ]} />
      )}

      <div className="sensbar">
        <div className="chips seg" role="group" aria-label="Sezione">
          <button className="chip" aria-pressed={tab === 'temperature'} onClick={() => setTab('temperature')}><span className="full">Temperature</span><span className="abbr">Temp.</span> {temps.length}</button>
          <button className="chip" aria-pressed={tab === 'switches'} onClick={() => setTab('switches')}><span className="full">Interruttori</span><span className="abbr">Interr.</span> {switchCount}</button>
        </div>
        {canManage ? (
          <div className="chips seg season-pick" role="group" aria-label="Stagione">
            {SEASONS.map((x) => (
              <button key={x.id} className="chip" aria-pressed={settings.season === x.id} disabled={busy} onClick={() => changeSeason(x.id)}>{x.label}</button>
            ))}
          </div>
        ) : <Badge kind={settings.season === 'estate' ? 'alta' : 'in_corso'}>{seasonLabel(settings.season)}</Badge>}
        <button type="button" className={`iconbtn${refreshing ? ' spin' : ''}`} onClick={refresh} disabled={refreshing || loading}
          aria-label={refreshing ? 'Aggiorno…' : 'Aggiorna i sensori'} title="Aggiorna"><Icon name="refresh" size={18} /></button>
      </div>
      <p className="muted season-note">
        {settings.season === 'estate' ? `Motori e impianti: sopra ${settings.summer_max}°C` : `Motori e impianti: sotto ${settings.winter_min}°C`}
        {' · '}Frigo e celle: sopra {settings.fridge_max}°C
        {' · '}{refreshing ? 'Aggiorno…' : refreshNote || (newest ? `dati ${formatDate(newest)}` : 'nessun dato')}
      </p>

      {loading && !data && <Spinner />}
      <ErrorText>{error || actionError}</ErrorText>
      {error && <Button onClick={reload}>Riprova</Button>}
      {tab === 'temperature' && (
        <div className="sgrid">
          {temps.map((s) => {
            const state = sensorState(s, now, settings)
            const limit = limitText(thresholdsFor(s, settings))
            return (
              <div key={s.id} className={`card stile ${state}`}>
                <div className="stile-name">{s.name}</div>
                <div className="stile-temp">{formatTemp(s.temperature)}</div>
                <div className="stile-meta">
                  <Badge kind={BADGE[state]}>{STATE_LABELS[state]}</Badge>
                  <span className="muted">Umidità {formatHumidity(s.humidity)}</span>
                </div>
                {limit && <div className="muted stile-small">{limit}</div>}
                <div className="stile-foot muted">
                  <span>{s.last_seen ? formatDate(s.last_seen) : 'Mai aggiornato'}</span>
                  {canManage && <button className="link-btn" disabled={busy} onClick={() => setActive(s.id, false)}>Nascondi</button>}
                </div>
              </div>
            )
          })}
          {data && temps.length === 0 && <div className="card muted">Nessun sensore di temperatura{canManage ? ': aggiungi il primo.' : '.'}</div>}
        </div>
      )}

      {tab === 'switches' && (
        <div className="list">
          {data && <p className="muted">Stato rilevato da eWeLink (sola lettura) · {SWITCH_GROUPS.map((g) => `${groups.find((x) => x.id === g.id)?.items.length || 0} ${g.label.toLowerCase()}`).join(' · ')}</p>}
          {groups.map((g) => (
            <div key={g.id} className="card stack">
              <div className="row"><h2>{g.label}</h2><span className="muted">{g.items.length}</span></div>
              <ul className="people">
                {g.items.map((s) => (
                  <li key={s.id}>
                    <span className="stack" style={{ gap: '0.15rem' }}>
                      <strong>{s.name}</strong>
                      <small className="muted">{s.last_seen ? `Ultima lettura: ${agoText(s.last_seen, now)}` : 'Nessuna lettura disponibile'}</small>
                    </span>
                    <span className="row" style={{ gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <Badge kind={GROUP_BADGE[g.id]}>{g.id === 'unreachable' ? `Non aggiornato · ultimo stato: ${switchLabel(s.switch_state)}` : switchLabel(s.switch_state)}</Badge>
                      {canManage && <button className="link-btn" disabled={busy} onClick={() => setActive(s.id, false)}>Nascondi</button>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {data && switchCount === 0 && <div className="card muted">Nessun interruttore visibile{canManage ? ': verifica i dispositivi eWeLink associati oppure aggiungi il primo.' : '.'}</div>}
        </div>
      )}

      {missing.length > 0 && (
        <div className="list">
          <button className="chip" aria-pressed={showMissing} onClick={() => setShowMissing((v) => !v)}>Non arrivano più ({missing.length})</button>
          {showMissing && (
            <div className="card stack">
              <p className="muted">Nessun dato da più di 24 ore: probabilmente non sono più nell'account eWeLink. Passa questo elenco a chi gestisce l'account.</p>
              <ul className="people">
                {missing.map((x) => (
                  <li key={x.id}><span>{x.name}</span><span className="muted">{agoText(x.last_seen, now)}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {canManage && hidden.length > 0 && (
        <div className="list">
          <button className="chip" aria-pressed={showHidden} onClick={() => setShowHidden((v) => !v)}>Nascosti ({hidden.length})</button>
          {showHidden && hidden.map((s) => (
            <div key={s.id} className="card row">
              <span>{s.name} <span className="muted">· {sensorKindLabel(s.kind)}</span></span>
              <button className="link-btn" disabled={busy} onClick={() => setActive(s.id, true)}>Mostra</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
