import test from 'node:test'
import assert from 'node:assert/strict'
import {
  can, allowed, PERM, roleLabel, bottomNavFor, isActivePath, menuGroupsFor, initialsFor, BOTTOM_SLOTS,
} from '../src/lib/permissions.js'

test('can() funziona con Set e array, e nega se non ci sono permessi', () => {
  assert.equal(can(new Set([PERM.ISSUES_VIEW]), PERM.ISSUES_VIEW), true)
  assert.equal(can([PERM.ISSUES_VIEW], PERM.ISSUES_CREATE), false)
  assert.equal(can(null, PERM.ISSUES_VIEW), false)
  assert.equal(can(undefined, PERM.ISSUES_VIEW), false)
})

test('la barra in basso ha 5 posti, con Home al centro', () => {
  const ids = bottomNavFor(new Set([PERM.ISSUES_VIEW, PERM.PLANNING_WORK_VIEW, PERM.URGENT_VIEW])).map((i) => i.id)
  assert.deepEqual(ids, ['operations', 'planning', 'home', 'task', 'more'])
  assert.equal(ids.indexOf('home'), 2)
  assert.equal(BOTTOM_SLOTS.find((i) => i.center).id, 'home')
})

test('il quinto posto è "Altro" (apre il menu) finché RandAI è in pausa', () => {
  const last = bottomNavFor(new Set([PERM.ISSUES_VIEW])).at(-1)
  assert.equal(last.id, 'more')
  assert.equal(last.action, 'menu')
  assert.equal(last.path, undefined)
})

test('con RandAI acceso il quinto posto è RandAI', () => {
  const last = bottomNavFor(new Set([PERM.ISSUES_VIEW]), { randai: true }).at(-1)
  assert.equal(last.id, 'randai')
  assert.equal(last.path, '/randai')
})

test('senza permesso di vedere le segnalazioni spariscono Operatività e Home', () => {
  const ids = bottomNavFor(new Set()).map((i) => i.id)
  assert.deepEqual(ids, ['more'])
})

test('Planning compare con almeno uno dei due permessi planning', () => {
  const ids = (perms) => bottomNavFor(new Set(perms)).map((i) => i.id)
  assert.ok(ids([PERM.PLANNING_WORK_VIEW]).includes('planning'))
  assert.ok(ids([PERM.PLANNING_SALE_VIEW]).includes('planning'))
  assert.ok(!ids([PERM.ISSUES_VIEW]).includes('planning'))
  assert.equal(allowed(new Set(), null), true)
  assert.equal(allowed(new Set(), [PERM.PLANNING_WORK_VIEW]), false)
})

test('Task compare con almeno uno dei due permessi task', () => {
  const ids = (perms) => bottomNavFor(new Set(perms)).map((i) => i.id)
  assert.ok(ids([PERM.URGENT_VIEW]).includes('task'))
  assert.ok(ids([PERM.REMINDERS_VIEW]).includes('task'))
  assert.ok(!ids([PERM.ISSUES_VIEW]).includes('task'))
})

test('Operatività resta accesa anche dentro le segnalazioni', () => {
  const operations = BOTTOM_SLOTS.find((i) => i.id === 'operations')
  assert.equal(isActivePath(operations, '/operations'), true)
  assert.equal(isActivePath(operations, '/issues'), true)
  assert.equal(isActivePath(operations, '/issues/abc'), true)
  assert.equal(isActivePath(operations, '/home'), false)
  assert.equal(isActivePath(operations, '/issuesX'), false)
})

test('il menu mostra "Nuova segnalazione" solo a chi può crearle', () => {
  const flat = (perms) => menuGroupsFor(perms).flatMap((g) => g.items.map((i) => i.id))
  assert.ok(flat(new Set([PERM.ISSUES_VIEW, PERM.ISSUES_CREATE])).includes('new-issue'))
  assert.ok(!flat(new Set([PERM.ISSUES_VIEW])).includes('new-issue'))
})

test('il menu mostra gli Interventi solo con il permesso giusto', () => {
  const flat = (perms) => menuGroupsFor(perms).flatMap((g) => g.items.map((i) => i.id))
  const view = new Set([PERM.ISSUES_VIEW, PERM.INTERVENTIONS_VIEW])
  assert.ok(flat(view).includes('interventions'))
  assert.ok(!flat(view).includes('new-intervention'))
  assert.ok(flat(new Set([...view, PERM.INTERVENTIONS_CREATE])).includes('new-intervention'))
  assert.ok(!flat(new Set([PERM.ISSUES_VIEW])).includes('interventions'))
})

test('Operatività resta accesa anche dentro gli interventi', () => {
  const operations = BOTTOM_SLOTS.find((i) => i.id === 'operations')
  assert.equal(isActivePath(operations, '/interventions'), true)
  assert.equal(isActivePath(operations, '/interventions/xyz'), true)
})

test('il menu ha sempre il profilo e nessun gruppo vuoto', () => {
  const groups = menuGroupsFor(new Set())
  assert.ok(groups.every((g) => g.items.length > 0))
  assert.ok(groups.flatMap((g) => g.items).some((i) => i.id === 'profile'))
})

test('iniziali del cerchio profilo', () => {
  assert.equal(initialsFor('Marco Bianchi'), 'MB')
  assert.equal(initialsFor('giulia'), 'G')
  assert.equal(initialsFor('Anna Maria Rossi'), 'AM')
  assert.equal(initialsFor(''), 'R')
  assert.equal(initialsFor(undefined), 'R')
})

test('etichette ruolo', () => {
  assert.equal(roleLabel('manutentore'), 'Manutentore')
  assert.equal(roleLabel('sconosciuto'), 'sconosciuto')
})
