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
