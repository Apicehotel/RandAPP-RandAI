import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (relative) => readFileSync(new URL('../' + relative, import.meta.url), 'utf8')

test('Twilio: template Authentication IT con scadenza 15 minuti', () => {
  const template = JSON.parse(read('twilio/templates/randapp_pin_recovery_it.json'))
  assert.equal(template.friendly_name, 'randapp_pin_recovery_it')
  assert.equal(template.language, 'it')
  assert.equal(template.types['whatsapp/authentication'].code_expiration_minutes, 15)
  assert.equal(template.types['whatsapp/authentication'].actions[0].type, 'COPY_CODE')
})

test('Recupero PIN: invii WhatsApp opt-in, segreti solo lato server', () => {
  const fn = read('supabase/functions/randapp-pin-recovery/index.ts')
  assert.match(fn, /TWILIO_RECOVERY_ENABLED.*=== "true"/)
  assert.match(fn, /TWILIO_OTP_PEPPER/)
  assert.match(fn, /TWILIO_PIN_CONTENT_SID/)
  assert.match(fn, /ContentVariables: JSON\.stringify\(\{ "1": otp \}\)/)
  assert.match(fn, /sha256\(`randapp:whatsapp-recovery:/)
  assert.match(fn, /if \(channel === "whatsapp" && !whatsappEnabled\)/)
  assert.match(fn, /select id, auth_user_id, expires_at, used_at[\s\S]*for update/)
  assert.match(fn, /update randapp\.pin_recovery_requests set used_at = now\(\) where id/)
  assert.match(fn, /consume\(`verify:\$\{userId\}`, 5\)/)
})

test('Interfaccia: recupero con scelta esplicita e OTP', () => {
  const login = read('src/screens/Login.jsx')
  const recover = read('src/screens/Recover.jsx')
  const api = read('src/data/recovery.js')
  assert.match(login, /Tramite email/)
  assert.match(login, /Tramite WhatsApp/)
  assert.match(login, /!channels\.whatsapp/)
  assert.match(recover, /recover-otp/)
  assert.match(recover, /completePinRecovery\(token, pin, whatsapp/)
  assert.match(api, /requestPinRecovery = \(userId, channel = 'email'\)/)
})

test('Creatore template Twilio non fa richieste per default', () => {
  const script = read('scripts/create-twilio-pin-template.mjs')
  assert.match(script, /process\.argv\.includes\('--create'\)/)
  assert.match(script, /if \(!create\)/)
})
