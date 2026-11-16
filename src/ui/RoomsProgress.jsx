import { useMemo, useState } from 'react'
import { Icon, formatDate } from './kit.jsx'
import { groupRoomsByFloor, roomsPercent, lastRoomDone } from '../lib/interventions.js'

const FILTERS = [
  { id: 'da_fare', label: 'Da fare' },
  { id: 'fatte', label: 'Fatte' },
  { id: 'tutte', label: 'Tutte' },
]

// Avanzamento delle camere di un intervento: barra, filtro, piani con "Segna tutte", camere da toccare.
// progress = roomsProgress(item). onChange(rooms[], done) segna o toglie; senza onChange è sola lettura.
export default function RoomsProgress({ progress, onChange, busy = false }) {
  const [filter, setFilter] = useState('da_fare')
  const [open, setOpen] = useState(null) // nome del piano aperto; null = il primo con camere da fare
  const floors = useMemo(() => groupRoomsByFloor(progress), [progress])
  const pct = roomsPercent(progress)
  const last = lastRoomDone(progress)
  const pending = progress.total - progress.done

  const shown = floors
    .map((f) => ({ ...f, list: f.rooms.filter((r) => filter === 'tutte' || (filter === 'fatte' ? r.done : !r.done)) }))
    .filter((f) => f.list.length > 0)
  const openName = open ?? shown[0]?.name ?? ''
  const counts = { da_fare: pending, fatte: progress.done, tutte: progress.total }

  return (
    <div className="card stack rooms-progress" data-testid="rooms-progress">
      <div className="row">
        <h2>Camere</h2>
        <strong>{progress.done} / {progress.total} · {pct}%</strong>
      </div>
      <div className="rprog" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label="Camere fatte">
        <div className="rprog-bar" style={{ width: `${pct}%` }} />
      </div>
      {last && <small className="muted">Ultima: {last.room}{last.by ? ` · ${last.by}` : ''}{last.at ? ` · ${formatDate(last.at)}` : ''}</small>}

      <div className="chips" role="group" aria-label="Filtro camere">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label} {counts[f.id]}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <p className="muted">{filter === 'da_fare' ? 'Tutte le camere sono fatte.' : 'Nessuna camera in questo filtro.'}</p>
      )}

      {shown.map((f) => {
        const isOpen = openName === f.name
        const allDone = f.done === f.total
        return (
          <div key={f.name} className="roomgroup">
            <div className="row">
              <button type="button" className={`chip floor${f.done ? ' has-sel' : ''}`} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : f.name)}>
                <Icon name="chevron" size={14} /> {f.name} · {f.done}/{f.total}
              </button>
              {onChange && (
                <button type="button" className="linkbtn" disabled={busy}
                  onClick={() => onChange(f.rooms.filter((r) => r.done === allDone).map((r) => r.room), !allDone)}>
                  {allDone ? 'Togli tutte' : 'Segna tutte'}
                </button>
              )}
            </div>
            {isOpen && (
              <div className="chips wrap rooms-grid">
                {f.list.map((r) => (
                  <button key={r.room} type="button" className={`chip room${r.done ? ' is-done' : ''}`} aria-pressed={r.done}
                    disabled={!onChange || busy} title={r.done && (r.by || r.at) ? `${r.by || ''} ${r.at ? formatDate(r.at) : ''}`.trim() : undefined}
                    onClick={() => onChange?.([r.room], !r.done)}>
                    {r.done ? '✓ ' : ''}{r.room}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
