import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as W from '../src/lib/warehouse.js'
import * as S from '../src/lib/supplies.js'
import * as H from '../src/lib/housekeeping.js'
import * as X from '../src/lib/sensors.js'
import { menuGroupsFor, PERM } from '../src/lib/permissions.js'

// ---- Magazzino
test('magazzino: sotto scorta ed esauriti', () => {
  assert.equal(W.isLow({ quantity: 2, min_quantity: 5 }), true)
  assert.equal(W.isLow({ quantity: 5, min_quantity: 5 }), true)
  assert.equal(W.isLow({ quantity: 6, min_quantity: 5 }), false)
  assert.equal(W.isLow({ quantity: 0, min_quantity: 0 }), false) // senza scorta minima non avvisa
  assert.equal(W.isOut({ quantity: 0 }), true)
})

test('magazzino: parseAmount accetta virgola e rifiuta il resto', () => {
  assert.equal(W.parseAmount('1,5'), 1.5)
  assert.equal(W.parseAmount(' 3 '), 3)
  assert.equal(W.parseAmount(''), null)
  assert.equal(W.parseAmount('abc'), null)
  assert.equal(W.parseAmount('-2'), null)
})

test('magazzino: formatQty e controllo movimenti', () => {
  assert.equal(W.formatQty(2, 'pz'), '2 pz')
  assert.equal(W.formatQty(1.5, 'kg'), '1,5 kg')
  const item = { quantity: 3 }
  assert.match(W.checkMove(item, 'scarico', 5), /insufficiente/i)
  assert.equal(W.checkMove(item, 'scarico', 3), '')
  assert.match(W.checkMove(item, 'carico', 0), /maggiore di zero/i)
  assert.equal(W.checkMove(item, 'rettifica', 0), '') // rettifica a zero è lecita
  assert.match(W.checkMove(item, 'carico', null), /valida/i)
})

test('magazzino: filtri e ricerca, archiviati nascosti', () => {
  const items = [
    { name: 'Rubinetto', category: 'Idraulica', quantity: 1, min_quantity: 3, active: true },
    { name: 'Lampadina E27', category: 'Elettrico', location: 'Scaffale B', quantity: 0, min_quantity: 2, active: true },
    { name: 'Vecchio', quantity: 9, min_quantity: 0, active: false },
  ]
  assert.deepEqual(W.filterItems(items).map((i) => i.name), ['Lampadina E27', 'Rubinetto'])
  assert.deepEqual(W.filterItems(items, { filter: 'esauriti' }).map((i) => i.name), ['Lampadina E27'])
  assert.equal(W.filterItems(items, { filter: 'sotto' }).length, 2)
  assert.deepEqual(W.filterItems(items, { query: 'scaffale' }).map((i) => i.name), ['Lampadina E27'])
  assert.deepEqual(W.summarizeWarehouse(items), { total: 2, low: 2, out: 1 })
})

// ---- Rifornimento
test('rifornimento: richieste aperte/chiuse e riepilogo', () => {
  const requests = [
    { id: 'a', created_at: '2026-10-30T10:00:00Z' },
    { id: 'b', created_at: '2026-10-31T10:00:00Z' },
  ]
  const items = [
    { id: 1, request_id: 'a', status: 'delivered' }, { id: 2, request_id: 'a', status: 'missing' },
    { id: 3, request_id: 'b', status: 'pending' }, { id: 4, request_id: 'b', status: 'delivered' },
  ]
  const joined = S.joinRequests(requests, items)
  assert.deepEqual(joined.map((r) => r.id), ['b', 'a']) // più recente prima
  assert.equal(joined[0].open, true)
  assert.equal(joined[1].open, false)
  assert.deepEqual(joined[1].summary, { total: 2, pending: 0, delivered: 1, missing: 1 })
  assert.equal(S.filterRequests(joined, 'aperte').length, 1)
  assert.equal(S.filterRequests(joined, 'chiuse').length, 1)
  assert.equal(S.filterRequests(joined, 'tutte').length, 2)
})

test('rifornimento: prodotti raggruppati per categoria, nascosti esclusi', () => {
  const groups = S.groupProducts([
    { id: 1, category: 'consumo', name: 'Sapone', sort_order: 0, active: true },
    { id: 2, category: 'minibar', name: 'Acqua', sort_order: 1, active: true },
    { id: 3, category: 'minibar', name: 'Birra', sort_order: 0, active: true },
    { id: 4, category: 'minibar', name: 'Vecchio', sort_order: 0, active: false },
  ])
  assert.deepEqual(groups.map((g) => g.id), ['minibar', 'consumo'])
  assert.deepEqual(groups[0].products.map((p) => p.name), ['Birra', 'Acqua'])
})

// ---- Housekeeping
test('housekeeping: ciclo degli stati e riepilogo', () => {
  assert.equal(H.nextStatus('dafare'), 'in_corso')
  assert.equal(H.nextStatus('in_corso'), 'fatto')
  assert.equal(H.nextStatus('fatto'), 'dafare')
  const rooms = [
    { room: '10', floor: 1, status: 'fatto', active: true },
    { room: '9', floor: 1, status: 'dafare', active: true },
    { room: '201', floor: 2, status: 'in_corso', active: true },
    { room: '999', floor: 2, status: 'dafare', active: false },
  ]
  assert.deepEqual(H.summarizeRooms(rooms), { total: 3, todo: 1, running: 1, done: 1 })
  const floors = H.groupByFloor(rooms)
  assert.deepEqual(floors.map((f) => f.label), ['Piano 1', 'Piano 2'])
  assert.deepEqual(floors[0].rooms.map((r) => r.room), ['9', '10']) // ordine numerico
  assert.equal(H.groupByFloor(rooms, { onlyOpen: true })[0].rooms.length, 1)
})

test('housekeeping: elenco camere scritto a mano e nomi dei piani', () => {
  assert.deepEqual(H.parseRoomList('201, 202;203  203'), ['201', '202', '203'])
  assert.deepEqual(H.parseRoomList(''), [])
  assert.equal(H.floorLabel(0), 'Piano terra')
  assert.equal(H.floorLabel(-1), 'Interrato 1')
})

// ---- Sensori
const NOW = Date.parse('2026-10-31T12:00:00Z')
const fresh = '2026-10-31T11:50:00Z'
test('sensori: stato regolare, allerta e non aggiornato', () => {
  const base = { kind: 'temperatura', online: true, last_seen: fresh, alert_min: 2, alert_max: 8 }
  assert.equal(X.sensorState({ ...base, temperature: 5 }, NOW), 'ok')
  assert.equal(X.sensorState({ ...base, temperature: 9 }, NOW), 'allerta')
  assert.equal(X.sensorState({ ...base, temperature: 1 }, NOW), 'allerta')
  assert.equal(X.sensorState({ ...base, temperature: 9, online: false }, NOW), 'offline')
  assert.equal(X.sensorState({ ...base, temperature: 5, last_seen: '2026-10-31T10:00:00Z' }, NOW), 'offline')
  assert.equal(X.sensorState({ ...base, temperature: 5, last_seen: null }, NOW), 'offline')
  assert.equal(X.sensorState({ kind: 'relay', online: true, last_seen: fresh, switch_state: 'on' }, NOW), 'ok')
})

test('sensori: formati, ordine e riepilogo', () => {
  assert.equal(X.formatTemp(4.56), '4,6°C')
  assert.equal(X.formatTemp(null), '—')
  assert.equal(X.formatHumidity(55.4), '55%')
  assert.equal(X.switchLabel('mixed'), 'Misto')
  assert.equal(X.switchLabel(null), 'Sconosciuto')
  const sensors = [
    { name: 'B', sort_order: 0, kind: 'temperatura', online: true, last_seen: fresh, temperature: 5, alert_max: 8 },
    { name: 'A', sort_order: 1, kind: 'temperatura', online: true, last_seen: fresh, temperature: 12, alert_max: 8 },
    { name: 'C', sort_order: 0, kind: 'relay', online: false },
    { name: 'D', sort_order: 0, kind: 'relay', online: true, last_seen: fresh, active: false },
  ]
  assert.deepEqual(X.sortSensors(sensors, NOW).map((s) => s.name), ['A', 'C', 'B'])
  assert.deepEqual(X.summarizeSensors(sensors, NOW), { total: 3, alert: 1, offline: 1, ok: 1 })
  assert.equal(X.optionalNumber(''), null)
  assert.equal(X.optionalNumber('4,5'), 4.5)
  assert.equal(X.optionalNumber('x'), undefined)
})

test('sensori: i nascosti si trovano e si possono rimostrare', () => {
  const list = [{ name: 'B', active: false }, { name: 'A', active: false }, { name: 'C', active: true }, { name: 'D' }]
  assert.deepEqual(X.hiddenSensors(list).map((s) => s.name), ['A', 'B'])
})

test('sensori: stagione inverno/estate per i motori, frigo e ambiente', () => {
  const base = { kind: 'temperatura', online: true, last_seen: fresh }
  const winter = { season: 'inverno', winter_min: 20, summer_max: 18, fridge_max: 0 }
  const summer = { ...winter, season: 'estate' }
  const motor = { ...base, role: 'motore' }
  assert.equal(X.sensorState({ ...motor, temperature: 15 }, NOW, winter), 'allerta') // inverno: sotto la minima
  assert.equal(X.sensorState({ ...motor, temperature: 57 }, NOW, winter), 'ok')
  assert.equal(X.sensorState({ ...motor, temperature: 15 }, NOW, summer), 'ok') // estate: conta solo il massimo
  assert.equal(X.sensorState({ ...motor, temperature: 25 }, NOW, summer), 'allerta')
  const fridge = { ...base, role: 'frigo' }
  assert.equal(X.sensorState({ ...fridge, temperature: 3 }, NOW, winter), 'allerta')
  assert.equal(X.sensorState({ ...fridge, temperature: -18 }, NOW, winter), 'ok')
  const room = { ...base, role: 'ambiente', alert_max: 26 }
  assert.equal(X.sensorState({ ...room, temperature: 27 }, NOW, winter), 'allerta')
  assert.deepEqual(X.thresholdsFor(motor, summer), { min: null, max: 18 })
  assert.deepEqual(X.thresholdsFor(motor, winter), { min: 20, max: null })
  assert.deepEqual(X.thresholdsFor({ role: 'ambiente' }, undefined), { min: null, max: null })
  // senza impostazioni usa i valori di partenza (inverno)
  assert.equal(X.sensorState({ ...motor, temperature: 10 }, NOW), 'allerta')
})

test('sensori: temperature e interruttori separati, interruttori per Acceso/Spento', () => {
  const sensors = [
    { name: 'T1', kind: 'temperatura' },
    { name: 'R2', kind: 'relay', online: true, last_seen: fresh, switch_state: 'on' },
    { name: 'R10', kind: 'relay', online: true, last_seen: fresh, switch_state: 'on' },
    { name: 'R1', kind: 'relay', online: true, last_seen: fresh, switch_state: 'off' },
    { name: 'R3', kind: 'relay', online: true, last_seen: fresh, switch_state: 'mixed' },
    { name: 'R4', kind: 'relay', online: false, last_seen: fresh, switch_state: 'on' },
    { name: 'R5', kind: 'relay', online: true, last_seen: '2026-10-01T00:00:00Z', switch_state: 'on' },
    { name: 'R6', kind: 'relay', online: true, last_seen: fresh, switch_state: null },
    { name: 'R7', kind: 'relay', online: true, last_seen: fresh, switch_state: 'on', active: false },
  ]
  assert.equal(X.temperatureSensors(sensors).length, 1)
  assert.equal(X.switchSensors(sensors).length, 8)
  const groups = X.groupSwitches(sensors, NOW)
  assert.deepEqual(groups.map((g) => g.id), ['on', 'off', 'mixed', 'unreachable'])
  assert.deepEqual(groups[0].items.map((s) => s.name), ['R2', 'R10']) // ordine numerico, nascosto escluso
  assert.deepEqual(groups[3].items.map((s) => s.name).sort(), ['R4', 'R5', 'R6'])
})

// ---- Menu
test('menu Gestione: ogni voce compare solo col suo permesso', () => {
  const ids = (perms) => menuGroupsFor(new Set(perms)).flatMap((g) => g.items.map((i) => i.id))
  assert.ok(!ids([PERM.ISSUES_VIEW]).includes('warehouse'))
  assert.ok(ids([PERM.WAREHOUSE_VIEW]).includes('warehouse'))
  assert.ok(ids([PERM.SUPPLIES_VIEW]).includes('supplies'))
  assert.ok(ids([PERM.HOUSEKEEPING_VIEW]).includes('housekeeping'))
  assert.ok(ids([PERM.SENSORS_VIEW]).includes('sensors'))
  assert.ok(!ids([PERM.SENSORS_VIEW]).includes('housekeeping'))
})

// ---- Schema
const dir = fileURLToPath(new URL('../supabase/migrations/', import.meta.url))
const sql = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(dir, f), 'utf8')).join('\n')
const policiesOf = (table) => [...sql.matchAll(new RegExp(`create policy\\s+\\w+\\s+on randapp\\.${table}[\\s\\S]*?;`, 'gi'))].map((m) => m[0])

test('moduli di gestione: hotel_id obbligatorio, policy con has_permission, niente DELETE', () => {
  const tables = { inventory_items: 'warehouse', inventory_movements: 'warehouse', supply_products: 'supplies',
    supply_requests: 'supplies', supply_request_items: 'supplies', hk_rooms: 'housekeeping', sensors: 'sensors' }
  for (const [table, prefix] of Object.entries(tables)) {
    assert.match(sql, new RegExp(`create table randapp\\.${table}[\\s\\S]*?hotel_id\\s+text not null`, 'i'), table)
    const policies = policiesOf(table)
    assert.ok(policies.length >= 1, table)
    for (const p of policies) assert.match(p, new RegExp(`has_permission\\(hotel_id,\\s*'${prefix}\\.`, 'i'), table)
    assert.doesNotMatch(sql, new RegExp(`create policy[^;]*on randapp\\.${table}\\s+for delete`, 'i'), table)
    assert.doesNotMatch(sql, new RegExp(`grant[^;]*delete[^;]*on[^;]*randapp\\.${table}`, 'i'), table)
  }
})

test('magazzino: la giacenza non è scrivibile dal browser, solo inventory_move()', () => {
  assert.doesNotMatch(sql, /grant\s+insert\s*\([^)]*\bquantity\b[^)]*\)\s+on randapp\.inventory_items/i)
  assert.doesNotMatch(sql, /grant\s+update\s*\([^)]*\bquantity\b[^)]*\)\s+on randapp\.inventory_items/i)
  assert.doesNotMatch(sql, /grant[^;]*(insert|update)[^;(]*on randapp\.inventory_movements/i)
  assert.match(sql, /function randapp\.inventory_move[\s\S]*security definer/i)
  assert.match(sql, /has_permission\(v_item\.hotel_id,\s*'warehouse\.move'\)/i)
  assert.match(sql, /grant execute on function randapp\.inventory_move\(uuid, text, numeric, text\) to authenticated/i)
})

test('rifornimento: richieste e righe si scrivono solo con le funzioni del server', () => {
  assert.doesNotMatch(sql, /grant[^;]*(insert|update)[^;(]*on randapp\.(supply_requests|supply_request_items)/i)
  assert.match(sql, /function randapp\.supply_create_request[\s\S]*security definer/i)
  assert.match(sql, /function randapp\.supply_resolve_item[\s\S]*security definer/i)
  assert.match(sql, /has_permission\(p_hotel,\s*'supplies\.create'\)/i)
  assert.match(sql, /has_permission\(v_hotel,\s*'supplies\.complete'\)/i)
})

test('housekeeping: dal browser solo stato e nota; struttura e giornata passano da funzioni con manage', () => {
  assert.match(sql, /grant update \(status, note, updated_by\) on randapp\.hk_rooms/i)
  assert.match(sql, /function randapp\.hk_set_room_active[\s\S]*security definer/i)
  assert.match(sql, /function randapp\.hk_reset_day[\s\S]*security definer/i)
  assert.equal([...sql.matchAll(/has_permission\((?:v_hotel|p_hotel),\s*'housekeeping\.manage'\)/gi)].length, 2)
})

test('stagione sensori: tabella per struttura con RLS, niente DELETE, solo sensors.manage scrive', () => {
  assert.match(sql, /create table randapp\.sensor_settings[\s\S]*?hotel_id\s+text primary key/i)
  const policies = policiesOf('sensor_settings')
  assert.equal(policies.length, 3)
  assert.match(policies[0], /sensors\.view/)
  assert.match(policies[1], /sensors\.manage/)
  assert.match(policies[2], /sensors\.manage/)
  assert.doesNotMatch(sql, /grant[^;]*delete[^;]*on[^;]*randapp\.sensor_settings/i)
  assert.match(sql, /season\s+text not null default 'inverno' check \(season in \('inverno','estate'\)\)/i)
})

test('sensori: le misure non sono scrivibili dal browser', () => {
  for (const col of ['temperature', 'humidity', 'switch_state', 'online', 'last_seen']) {
    assert.doesNotMatch(sql, new RegExp(`grant\\s+(insert|update)\\s*\\([^)]*\\b${col}\\b[^)]*\\)\\s+on randapp\\.sensors`, 'i'), col)
  }
})

// ---- Moduli di inserimento (0011)
import * as F from '../src/lib/forms.js'

const LOCS = [
  { kind: 'room', name: '101', group_name: 'Wine P1', sort_order: 1, active: true },
  { kind: 'room', name: '102', group_name: 'Wine P1', sort_order: 2, active: true },
  { kind: 'room', name: '201', group_name: 'Wine P2', sort_order: 3, active: true },
  { kind: 'zone', name: 'Hall Jazz', aliases: ['ingresso jazz', 'hall'], sort_order: 10, active: true },
  { kind: 'zone', name: 'Cucina', aliases: [], sort_order: 11, active: false },
]

test('moduli: suggerimenti camere per inizio numero e zone per sinonimo', () => {
  assert.deepEqual(F.suggestLocations(LOCS, '10'), ['101', '102'])
  assert.deepEqual(F.suggestLocations(LOCS, 'ingresso'), ['Hall Jazz'])
  assert.deepEqual(F.suggestLocations(LOCS, 'cucina'), []) // disattivata
  assert.deepEqual(F.suggestLocations(LOCS, ''), [])
})

test('moduli: il luogo deve esistere, ma senza catalogo il testo è libero', () => {
  assert.equal(F.locationOk(LOCS, '101'), true)
  assert.equal(F.locationOk(LOCS, '999'), false)
  assert.equal(F.locationOk([], 'qualsiasi'), true)
  assert.equal(F.locationOk(LOCS, ''), false)
})

test('moduli: camere a piani, selezione di un intero piano e testo del luogo', () => {
  assert.deepEqual(F.roomGroups(LOCS).map((g) => g.name), ['Wine P1', 'Wine P2'])
  assert.deepEqual(F.togglePlan([], ['101', '102']), ['101', '102'])
  assert.deepEqual(F.togglePlan(['101', '102', '201'], ['101', '102']), ['201'])
  assert.equal(F.locationLabel(['101', '102'], 'Hall'), '101, 102, Hall')
  const long = Array.from({ length: 20 }, (_, i) => String(1000 + i))
  assert.ok(F.locationLabel(long).length <= 40)
  assert.equal(F.locationLabel(long), '1000 +19')
})

test('moduli: periodo, preparazione sala e PAX', () => {
  assert.equal(F.rangeOk('2026-11-02T10:00', '2026-11-02T09:00'), false)
  assert.equal(F.rangeOk('2026-11-02T10:00', ''), true)
  assert.equal(F.prepOk('2026-11-01', '2026-11-02'), true)
  assert.equal(F.prepOk('2026-11-03', '2026-11-02'), false)
  assert.equal(F.prepOk('', '2026-11-02'), false)
  assert.equal(F.clampPax('0', 0), 1)
  assert.equal(F.clampPax('5000', 1), 5000)
  assert.equal(F.clampPax('10', 1), 11)
})

test('moduli: colleghi assegnabili e richiamo cliente', () => {
  const staff = [
    { user_id: 'a', display_name: 'Ada', role: 'manutentore' },
    { user_id: 'b', display_name: 'Bea', role: 'reception' },
  ]
  assert.deepEqual(F.assignable(staff).map((p) => p.user_id), ['a'])
  assert.deepEqual(F.staffNames(staff, ['b', 'x', 'a']), ['Bea', 'Ada'])
  const c = F.findClient([{ name: 'ACME Spa', preferred_room: 'Sala 1', preferred_layout: 'Teatro', preferred_pax: 80, notes: 'Caffè' }], ' acme spa ')
  assert.equal(c.preferred_room, 'Sala 1')
  const f = F.applyRecall({ client: 'acme', room: '', layout: '', pax: '1', notes: '' }, c)
  assert.deepEqual([f.client, f.room, f.layout, f.pax, f.notes], ['ACME Spa', 'Sala 1', 'Teatro', '80', 'Caffè'])
})

test('moduli: la bozza si salva, si riprende e non rompe senza storage', () => {
  const mem = new Map()
  const st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) }
  F.saveDraft('issue', 'h1', 'u1', { title: 'Perde' }, st)
  assert.deepEqual(F.loadDraft('issue', 'h1', 'u1', st), { title: 'Perde' })
  assert.equal(F.loadDraft('issue', 'h2', 'u1', st), null) // altra struttura: altra bozza
  F.clearDraft('issue', 'h1', 'u1', st)
  assert.equal(F.loadDraft('issue', 'h1', 'u1', st), null)
  const broken = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') }, removeItem() { throw new Error('x') } }
  assert.equal(F.loadDraft('issue', 'h1', 'u1', broken), null)
  F.saveDraft('issue', 'h1', 'u1', {}, broken)
})

test('0011: tabelle nuove con hotel_id e RLS, niente DELETE, colleghi solo via funzione', () => {
  const sql = readFileSync(join(import.meta.dirname, '../supabase/migrations/0011_forms.sql'), 'utf8')
  for (const t of ['hotel_locations', 'sale_rooms', 'sale_layouts', 'sale_clients']) {
    assert.match(sql, new RegExp(`create table randapp\\.${t}[\\s\\S]*?hotel_id\\s+text not null references randapp\\.hotels`), `${t}: hotel_id`)
    assert.match(sql, new RegExp(`alter table randapp\\.${t}\\s+enable row level security`), `${t}: RLS`)
  }
  assert.doesNotMatch(sql, /for delete|grant[^;]*delete/i)
  assert.match(sql, /function randapp\.hotel_staff[\s\S]*is_hotel_member\(p_hotel\)/)
  assert.match(sql, /planning_sale\.manage/)
  // il browser non può scrivere il catalogo luoghi senza locations.manage
  assert.match(sql, /hotel_locations_insert[\s\S]*locations\.manage/)
})
