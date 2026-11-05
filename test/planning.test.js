import test from 'node:test'
import assert from 'node:assert/strict'
import {
  toIso, addDaysIso, weekStartIso, weekDaysIso, dayLabel, worksOnDay, worksInWeek,
  shiftsOverlap, datesOverlap, bookingConflicts, bookingsOnDay, roomNames,
} from '../src/lib/planning.js'

test('la settimana parte dal lunedì', () => {
  assert.equal(weekStartIso('2026-10-31'), '2026-10-26') // sabato
  assert.equal(weekStartIso('2026-10-26'), '2026-10-26') // lunedì
  assert.equal(weekStartIso('2026-11-01'), '2026-10-26') // domenica
  assert.deepEqual(weekDaysIso('2026-10-26').at(-1), '2026-11-01')
})

test('addDaysIso attraversa mese e anno senza slittare di fuso', () => {
  assert.equal(addDaysIso('2026-10-31', 1), '2026-11-01')
  assert.equal(addDaysIso('2026-12-31', 1), '2027-01-01')
  assert.equal(addDaysIso('2026-03-01', -1), '2026-02-28')
  assert.equal(addDaysIso('2026-10-25', 1), '2026-10-26') // cambio ora legale
  assert.equal(toIso(new Date(2026, 0, 5)), '2026-01-05')
})

test('etichetta del giorno', () => {
  assert.equal(dayLabel('2026-10-31'), 'Sab 31/10')
})

test('lavori per giorno e per settimana', () => {
  const works = [
    { id: 'a', days: ['2026-10-27', '2026-10-28'] },
    { id: 'b', days: ['2026-11-03'] },
  ]
  assert.deepEqual(worksOnDay(works, '2026-10-28').map((w) => w.id), ['a'])
  assert.deepEqual(worksInWeek(works, '2026-10-26').map((w) => w.id), ['a'])
  assert.deepEqual(worksInWeek(works, '2026-11-02').map((w) => w.id), ['b'])
})

test('turni: "tutto il giorno" blocca tutti', () => {
  assert.equal(shiftsOverlap('mattina', 'mattina'), true)
  assert.equal(shiftsOverlap('mattina', 'sera'), false)
  assert.equal(shiftsOverlap('giornata', 'sera'), true)
  assert.equal(shiftsOverlap('pomeriggio', 'giornata'), true)
})

test('periodi che si toccano si sovrappongono', () => {
  assert.equal(datesOverlap('2026-11-01', '2026-11-03', '2026-11-03', '2026-11-05'), true)
  assert.equal(datesOverlap('2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05'), false)
})

const b = (id, room, from, to, shift, status = 'attiva') => ({ id, room, client: id, date_from: from, date_to: to, shift, status })

test('conflitti sale: stessa sala, periodo e turno; ignora annullate e altre sale', () => {
  const existing = [
    b('x', 'Sala Giotto', '2026-11-02', '2026-11-04', 'mattina'),
    b('y', 'Sala Giotto', '2026-11-02', '2026-11-04', 'sera', 'annullata'),
    b('z', 'Sala Dante', '2026-11-02', '2026-11-04', 'mattina'),
  ]
  const cand = (room, shift, from = '2026-11-03', to = '2026-11-03') => ({ room, shift, date_from: from, date_to: to })
  assert.deepEqual(bookingConflicts(cand(' sala giotto ', 'mattina'), existing).map((x) => x.id), ['x'])
  assert.deepEqual(bookingConflicts(cand('Sala Giotto', 'sera'), existing), [])
  assert.deepEqual(bookingConflicts(cand('Sala Giotto', 'giornata'), existing).map((x) => x.id), ['x'])
  assert.deepEqual(bookingConflicts(cand('Sala Giotto', 'mattina', '2026-11-05', '2026-11-05'), existing), [])
})

test('una prenotazione non confligge con se stessa', () => {
  const existing = [b('x', 'Sala', '2026-11-02', '2026-11-02', 'mattina')]
  assert.deepEqual(bookingConflicts({ ...existing[0] }, existing), [])
})

test('prenotazioni del giorno: solo attive, ordinate per turno; nomi sale unici', () => {
  const list = [
    b('sera', 'B', '2026-11-02', '2026-11-02', 'sera'),
    b('matt', 'A', '2026-11-01', '2026-11-03', 'mattina'),
    b('ann', 'C', '2026-11-02', '2026-11-02', 'mattina', 'annullata'),
    b('fuori', 'D', '2026-11-09', '2026-11-09', 'mattina'),
  ]
  assert.deepEqual(bookingsOnDay(list, '2026-11-02').map((x) => x.id), ['matt', 'sera'])
  assert.deepEqual(roomNames(list), ['A', 'B', 'C', 'D'])
})

// ---- Allineamento al vecchio Planning (0012)
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  dayStats, workDaysOn, prepStats, bookingsToPrepare, eventOnDay, checksReady, roomAvailability, roomsByFamily,
  comboParts, roomParts,
} from '../src/lib/planning.js'

test('lavori: uno stato per giorno, annullati esclusi, statistiche di oggi', () => {
  const rows = [
    { id: 1, day: '2026-11-02', status: 'da_fare' },
    { id: 2, day: '2026-11-02', status: 'da_finire' },
    { id: 3, day: '2026-11-02', status: 'fatto' },
    { id: 4, day: '2026-11-02', status: 'annullato' },
    { id: 5, day: '2026-11-03', status: 'da_fare' },
  ]
  assert.deepEqual(workDaysOn(rows, '2026-11-02').map((r) => r.id), [1, 2, 3])
  assert.deepEqual(dayStats(rows, '2026-11-02'), { today: 2, finish: 1, done: 1 })
})

test('sale: la lista operativa segue il giorno di preparazione, il calendario l\'evento', () => {
  const bs = [
    { id: 'a', date_from: '2026-11-05', date_to: '2026-11-06', prep_date: '2026-11-04', status: 'attiva', op_status: 'da_fare' },
    { id: 'b', date_from: '2026-11-04', date_to: '2026-11-04', prep_date: null, status: 'attiva', op_status: 'fatto' },
    { id: 'c', date_from: '2026-11-04', date_to: '2026-11-04', prep_date: '2026-11-04', status: 'annullata', op_status: 'da_fare' },
  ]
  assert.deepEqual(bookingsToPrepare(bs, '2026-11-04').map((b) => b.id), ['a', 'b'])
  assert.deepEqual(prepStats(bs, '2026-11-04'), { today: 1, finish: 0, done: 1 })
  assert.equal(eventOnDay(bs[0], '2026-11-06'), true)
  assert.equal(eventOnDay(bs[0], '2026-11-04'), false)
  assert.equal(eventOnDay(bs[2], '2026-11-04'), false)
})

test('sale: "Fatto" si può solo con Audio/Video OK o non richiesti', () => {
  assert.equal(checksReady({ audio_status: 'non_richiesto', video_status: 'non_richiesto' }), true)
  assert.equal(checksReady({ audio_status: 'ok', video_status: 'non_richiesto' }), true)
  assert.equal(checksReady({ audio_status: 'da_verificare', video_status: 'ok' }), false)
  assert.equal(checksReady({ audio_status: 'ok', video_status: 'problema' }), false)
})

const R = (id, name, family, parts, sort) => ({ id, name, family, parts, sort_order: sort, active: true })
const ROOMS = [
  R('s1', 'Sax 1', 'Sax', [], 1), R('s2', 'Sax 2', 'Sax', [], 2), R('s12', 'Sax 1+2', 'Sax', ['s1', 's2'], 3),
  R('t1', 'Trumpet 1', 'Trumpet', [], 4),
]
const bk = (room, shift, from = '2026-11-10', to = '2026-11-10', status = 'attiva') => ({ id: room + shift, room, shift, date_from: from, date_to: to, status })
const per = (shift) => ({ date_from: '2026-11-10', date_to: '2026-11-10', shift })

test('sale: combinazioni condividono le parti, le singole no', () => {
  assert.deepEqual(roomParts(ROOMS[0]), ['s1'])
  assert.deepEqual(comboParts([ROOMS[0], ROOMS[1]]), ['s1', 's2'])
  const taken = [bk('Sax 1', 'mattina')]
  assert.equal(roomAvailability(ROOMS[2], per('mattina'), taken, ROOMS), 'busy') // Sax 1+2 occupa anche Sax 1
  assert.equal(roomAvailability(ROOMS[1], per('mattina'), taken, ROOMS), 'free')
  assert.equal(roomAvailability(ROOMS[3], per('mattina'), taken, ROOMS), 'free')
})

test('sale: libera · parziale · occupata secondo il turno', () => {
  const taken = [bk('Sax 1', 'mattina')]
  assert.equal(roomAvailability(ROOMS[0], per('pomeriggio'), taken, ROOMS), 'free')
  assert.equal(roomAvailability(ROOMS[0], per('mattina'), taken, ROOMS), 'busy')
  assert.equal(roomAvailability(ROOMS[0], per('giornata'), taken, ROOMS), 'partial')
  assert.equal(roomAvailability(ROOMS[0], per('mattina'), [bk('Sax 1', 'mattina', '2026-11-10', '2026-11-10', 'annullata')], ROOMS), 'free')
  assert.equal(roomAvailability(ROOMS[0], per('mattina'), taken, ROOMS, 'Sax 1mattina'), 'free') // modifica: ignora se stessa
})

test('sale: i conflitti tengono conto delle combinazioni', () => {
  const existing = [{ ...bk('Sax 1+2', 'mattina'), id: 'x', date_from: '2026-11-10', date_to: '2026-11-10' }]
  const cand = { room: 'Sax 2', shift: 'mattina', date_from: '2026-11-10', date_to: '2026-11-10' }
  assert.equal(bookingConflicts(cand, existing).length, 0) // senza elenco sale: solo il nome
  assert.equal(bookingConflicts(cand, existing, ROOMS).length, 1) // con l'elenco: parti condivise
})

test('sale: famiglie in ordine', () => {
  assert.deepEqual(roomsByFamily(ROOMS).map((g) => g.name), ['Sax', 'Trumpet'])
})

test('0012: stati solo da funzioni del server, niente DELETE, check non scrivibili dal browser', () => {
  const sql = readFileSync(join(import.meta.dirname, '../supabase/migrations/0012_planning_ops.sql'), 'utf8')
  assert.match(sql, /create table randapp\.planning_work_days[\s\S]*?hotel_id\s+text not null/)
  assert.match(sql, /alter table randapp\.planning_work_days enable row level security/)
  assert.doesNotMatch(sql, /create policy[^;]*on randapp\.planning_work_days\s+for (insert|update|delete)/i)
  assert.match(sql, /grant select on randapp\.planning_work_days to authenticated/)
  assert.doesNotMatch(sql, /grant[^;]*delete/i)
  for (const fn of ['planning_work_day_set', 'sale_booking_set_op', 'sale_booking_set_check']) {
    assert.match(sql, new RegExp(`function randapp\\.${fn}[\\s\\S]*?security definer`), fn)
    assert.match(sql, new RegExp(`revoke all on function randapp\\.${fn}`), fn)
  }
  assert.match(sql, /has_permission\(v_row\.hotel_id, 'planning_work\.update'\)/)
  assert.match(sql, /has_permission\(v_row\.hotel_id, 'planning_sale\.operate'\)/)
  // le colonne di stato/check non sono nel grant di insert/update del browser
  const grants = [...sql.matchAll(/grant (?:insert|update) \(([^)]*)\)\s+on randapp\.sale_bookings/g)].map((m) => m[1]).join(' ')
  for (const col of ['op_status', 'op_by_name', 'audio_status', 'video_status', 'audio_by_name', 'video_at']) {
    assert.doesNotMatch(grants, new RegExp(col), col)
  }
  assert.match(sql, /grant update \(description, category, assignee_ids\) on randapp\.planning_works/)
  // Fatto bloccato se i check richiesti non sono OK
  assert.match(sql, /p_status = 'fatto' and \(v_row\.audio_status not in/)
})

import { monthGrid, addMonthsIso, monthLabel } from '../src/lib/planning.js'
test('calendario mensile: settimane lun-dom che coprono il mese', () => {
  const g = monthGrid('2026-11-15')
  assert.equal(g[0][0], '2026-10-26') // 1 novembre 2026 è domenica: la griglia parte da lunedì 26/10
  assert.ok(g.at(-1).includes('2026-11-30')) // 30/11 è lunedì: l'ultima riga arriva a domenica 6/12
  assert.ok(g.every((w) => w.length === 7))
  assert.equal(addMonthsIso('2026-12-20', 1), '2027-01-01')
  assert.equal(monthLabel('2026-11-05'), 'Novembre 2026')
})

test('prenotazione vecchia "Auditorium" occupa Auditorium Intero e le due Tower', () => {
  const rooms = [
    { id: 'a', name: 'Auditorium Intero', parts: ['t1', 't2'] },
    { id: 'b', name: 'Auditorium Tower 1', parts: ['t1'] },
    { id: 'c', name: 'Cantina', parts: ['cantina'] },
  ]
  const bookings = [{ id: 'x', room: 'Auditorium', status: 'attiva', shift: 'giornata', date_from: '2026-11-10', date_to: '2026-11-10' }]
  const period = { date_from: '2026-11-10', date_to: '2026-11-10', shift: 'mattina' }
  assert.equal(roomAvailability(rooms[0], period, bookings, rooms), 'busy')
  assert.equal(roomAvailability(rooms[1], period, bookings, rooms), 'busy')
  assert.equal(roomAvailability(rooms[2], period, bookings, rooms), 'free')
})
