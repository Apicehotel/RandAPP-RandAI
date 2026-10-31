import { useState } from 'react'
import { listSensors, updateSensor } from '../data/sensors.js'
import { useAsync, go } from '../lib/hooks.js'
import { can, PERM } from '../lib/permissions.js'
import {
  STATE_LABELS, formatHumidity, formatTemp, sensorKindLabel, sensorState, sortSensors, summarizeSensors, switchLabel,
} from '../lib/sensors.js'
import { Badge, Button, ErrorText, Spinner, formatDate } from '../ui/kit.jsx'

const BADGE = { ok: 'fatto', allerta: 'aperto', offline: 'alta' }

export default function Sensors({ ctx }) {
  const { data, error, loading, reload } = useAsync(() => listSensors(ctx.hotelId), [ctx.hotelId])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const canManage = can(ctx.permissions, PERM.SENSORS_MANAGE)
  const list = sortSensors(data || [])
  const sum = summarizeSensors(data || [])

  const hide = async (id) => {
    setBusy(true); setActionError('')
    try { await updateSensor(ctx.hotelId, id, { active: false }); await reload() }
    catch (e) { setActionError(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="page">
      <div className="row">
        <h1>Sensori e impianti</h1>
        {canManage && <Button variant="primary" onClick={() => go('/sensors/new')}>+ Sensore</Button>}
      </div>
      {data && <p className="muted">{sum.total} dispositivi · {sum.alert} in allerta · {sum.offline} non aggiornati</p>}
      <p className="muted">I valori si aggiorneranno da soli quando sarà attiva la sincronizzazione con i dispositivi.</p>

      {loading && !data && <Spinner />}
      <ErrorText>{error || actionError}</ErrorText>
      {error && <Button onClick={reload}>Riprova</Button>}

      <div className="list">
        {list.map((s) => {
          const state = sensorState(s)
          return (
            <div key={s.id} className="card stack">
              <div className="row"><strong>{s.name}</strong><Badge kind={BADGE[state]}>{STATE_LABELS[state]}</Badge></div>
              {s.kind === 'temperatura' ? (
                <div className="row"><span className="stat-num">{formatTemp(s.temperature)}</span><span className="muted">Umidità {formatHumidity(s.humidity)}</span></div>
              ) : (
                <div className="row"><span className="stat-num">{switchLabel(s.switch_state)}</span><span className="muted">{sensorKindLabel(s.kind)}</span></div>
              )}
              <div className="row muted">
                <span>{s.last_seen ? `Aggiornato ${formatDate(s.last_seen)}` : 'Mai aggiornato'}</span>
                {canManage && <button className="link-btn" disabled={busy} onClick={() => hide(s.id)}>Nascondi</button>}
              </div>
            </div>
          )
        })}
        {data && list.length === 0 && <div className="card muted">Nessun sensore{canManage ? ': aggiungi il primo.' : '.'}</div>}
      </div>
    </div>
  )
}
