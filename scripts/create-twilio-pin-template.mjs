// Crea il template Twilio su richiesta esplicita; il default e' SOLO anteprima.
// Esecuzione: node scripts/create-twilio-pin-template.mjs [--create]
// Richiede TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN soltanto con --create.
import { readFileSync } from 'node:fs'

const template = JSON.parse(readFileSync(new URL('../twilio/templates/randapp_pin_recovery_it.json', import.meta.url), 'utf8'))
const create = process.argv.includes('--create')
if (!create) {
  console.log(JSON.stringify(template, null, 2))
  console.log('Anteprima: nessuna richiesta a Twilio. Per creare il template serve --create e autorizzazione.')
  process.exit(0)
}
const sid = process.env.TWILIO_ACCOUNT_SID || ''
const token = process.env.TWILIO_AUTH_TOKEN || ''
if (!/^AC[a-f0-9]{32}$/i.test(sid) || !token) {
  console.error('Mancano TWILIO_ACCOUNT_SID e/o TWILIO_AUTH_TOKEN nel terminale.')
  process.exit(1)
}
const response = await fetch('https://content.twilio.com/v1/Content', {
  method: 'POST',
  headers: {
    Authorization: 'Basic ' + Buffer.from(sid + ':' + token).toString('base64'),
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(template),
})
if (!response.ok) {
  console.error('Twilio Content API: creazione non riuscita (HTTP ' + response.status + ').')
  process.exit(1)
}
const result = await response.json()
console.log('Template creato. Content SID: ' + result.sid)
console.log('Inviare a WhatsApp per approvazione nel Content Template Builder; NON abilita gli invii.')
