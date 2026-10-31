import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
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
const dir = new URL('../supabase/migrations/', import.meta.url).pathname
const sql = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(dir, f), 'utf8')).join('\n')
const policiesOf = (table) => [...sql.matchAll(new RegExp(`create policy\\s+\\w+\\s+on public\\.${table}[\\s\\S]*?;`, 'gi'))].map((m) => m[0])

test('moduli di gestione: hotel_id obbligatorio, policy con has_permission, niente DELETE', () => {
  const tables = { inventory_items: 'warehouse', inventory_movements: 'warehouse', supply_products: 'supplies',
    supply_requests: 'supplies', supply_request_items: 'supplies', hk_rooms: 'housekeeping', sensors: 'sensors' }
  for (const [table, prefix] of Object.entries(tables)) {
    assert.match(sql, new RegExp(`create table public\\.${table}[\\s\\S]*?hotel_id\\s+text not null`, 'i'), table)
    const policies = policiesOf(table)
    assert.ok(policies.length >= 1, table)
    for (const p of policies) assert.match(p, new RegExp(`has_permission\\(hotel_id,\\s*'${prefix}\\.`, 'i'), table)
    assert.doesNotMatch(sql, new RegExp(`create policy[^;]*on public\\.${table}\\s+for delete`, 'i'), table)
    assert.doesNotMatch(sql, new RegExp(`grant[^;]*delete[^;]*on[^;]*public\\.${table}`, 'i'), table)
  }
})

test('magazzino: la giacenza non è scrivibile dal browser, solo inventory_move()', () => {
  assert.doesNotMatch(sql, /grant\s+insert\s*\([^)]*\bquantity\b[^)]*\)\s+on public\.inventory_items/i)
  assert.doesNotMatch(sql, /grant\s+update\s*\([^)]*\bquantity\b[^)]*\)\s+on public\.inventory_items/i)
  assert.doesNotMatch(sql, /grant[^;]*(insert|update)[^;(]*on public\.inventory_movements/i)
  assert.match(sql, /function public\.inventory_move[\s\S]*security definer/i)
  assert.match(sql, /has_permission\(v_item\.hotel_id,\s*'warehouse\.move'\)/i)
  assert.match(sql, /grant execute on function public\.inventory_move\(uuid, text, numeric, text\) to authenticated/i)
})

test('rifornimento: richieste e righe si scrivono solo con le funzioni del server', () => {
  assert.doesNotMatch(sql, /grant[^;]*(insert|update)[^;(]*on public\.(supply_requests|supply_request_items)/i)
  assert.match(sql, /function public\.supply_create_request[\s\S]*security definer/i)
  assert.match(sql, /function public\.supply_resolve_item[\s\S]*security definer/i)
  assert.match(sql, /has_permission\(p_hotel,\s*'supplies\.create'\)/i)
  assert.match(sql, /has_permission\(v_hotel,\s*'supplies\.complete'\)/i)
})

test('housekeeping: dal browser solo stato e nota; struttura e giornata passano da funzioni con manage', () => {
  assert.match(sql, /grant update \(status, note, updated_by\) on public\.hk_rooms/i)
  assert.match(sql, /function public\.hk_set_room_active[\s\S]*security definer/i)
  assert.match(sql, /function public\.hk_reset_day[\s\S]*security definer/i)
  assert.equal([...sql.matchAll(/has_permission\((?:v_hotel|p_hotel),\s*'housekeeping\.manage'\)/gi)].length, 2)
})

test('sensori: le misure non sono scrivibili dal browser', () => {
  for (const col of ['temperature', 'humidity', 'switch_state', 'online', 'last_seen']) {
    assert.doesNotMatch(sql, new RegExp(`grant\\s+(insert|update)\\s*\\([^)]*\\b${col}\\b[^)]*\\)\\s+on public\\.sensors`, 'i'), col)
  }
})
