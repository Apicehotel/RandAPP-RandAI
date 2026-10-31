#!/usr/bin/env node
// Crea un utente con PIN (da eseguire in locale da chi amministra).
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/create-user.mjs --name "Mario Rossi" --hotels hotelgio,chocohotel --role manutentore --pin 1234
// La chiave di servizio resta nel tuo terminale: non va mai nel browser, nel repo o in un file committato.
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const ROLES = ['admin', 'direzione', 'responsabile', 'manutentore', 'governante', 'reception']
const HOTELS = ['hotelgio', 'chocohotel', 'brigantino']

function args(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 2) out[argv[i].replace(/^--/, '')] = argv[i + 1]
  return out
}

const a = args(process.argv.slice(2))
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const hotels = String(a.hotels || '').split(',').map((h) => h.trim()).filter(Boolean)

const problems = []
if (!url || !key) problems.push('Imposta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nel terminale.')
if (!a.name?.trim()) problems.push('--name mancante')
if (!ROLES.includes(a.role)) problems.push(`--role deve essere uno tra: ${ROLES.join(', ')}`)
if (!hotels.length || hotels.some((h) => !HOTELS.includes(h))) problems.push(`--hotels deve contenere: ${HOTELS.join(', ')}`)
if (!/^\d{4}$/.test(a.pin || '')) problems.push('--pin deve essere di 4 cifre')
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const { data: created, error: createError } = await admin.auth.admin.createUser({
  email: `u-${randomUUID()}@auth.invalid`,
  password: randomUUID() + randomUUID(),
  email_confirm: true,
  user_metadata: { display_name: a.name.trim() },
})
if (createError) {
  console.error('Creazione utente fallita:', createError.message)
  process.exit(1)
}
const id = created.user.id

const steps = [
  admin.from('profiles').insert({ auth_user_id: id, display_name: a.name.trim() }),
]
const [{ error: profileError }] = await Promise.all(steps)
if (profileError) {
  await admin.auth.admin.deleteUser(id)
  console.error('Profilo non creato:', profileError.message)
  process.exit(1)
}

const { error: memberError } = await admin
  .from('hotel_memberships')
  .insert(hotels.map((hotel_id) => ({ auth_user_id: id, hotel_id, role: a.role })))
const { error: pinError } = await admin
  .from('auth_pin_credentials')
  .insert({ auth_user_id: id, pin_hash: await bcrypt.hash(a.pin, 11) })

if (memberError || pinError) {
  await admin.auth.admin.deleteUser(id) // cancella a cascata profilo, membership e PIN
  console.error('Operazione annullata:', (memberError || pinError).message)
  process.exit(1)
}

console.log(`Creato ${a.name.trim()} (${a.role}) su: ${hotels.join(', ')}`)
