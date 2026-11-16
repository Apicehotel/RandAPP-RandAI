import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  categoryFrom, findRoom, normalizePhone, plausibleRoom, sniffImage, titleFrom, twilioSignedString, urgencyFrom,
} from '../supabase/functions/_shared/whatsapp-parse.js'
import { CATEGORIES } from '../src/lib/queue.js'

test('numeri: formato internazionale, whatsapp: e senza prefisso', () => {
  assert.equal(normalizePhone('whatsapp:+393331234567'), '+393331234567')
  assert.equal(normalizePhone('333 1234567'), '+393331234567')
  assert.equal(normalizePhone('393331234567'), '+393331234567')
  assert.equal(normalizePhone(''), null)
  assert.equal(normalizePhone('12'), null)
})

test('firma Twilio: URL + parametri ordinati, HMAC-SHA1 (esempio della documentazione Twilio)', () => {
  const params = new URLSearchParams({ Digits: '1234', To: '+18005551212', From: '+14158675310', Caller: '+14158675310', CallSid: 'CA1234567890ABCDE' })
  const signed = twilioSignedString('https://mycompany.com/myapp.php?foo=1&bar=2', params)
  assert.equal(signed, 'https://mycompany.com/myapp.php?foo=1&bar=2CallSidCA1234567890ABCDECaller+14158675310Digits1234From+14158675310To+18005551212')
  assert.equal(createHmac('sha1', '12345').update(signed).digest('base64'), 'GvWf1cFY/Q7PnoempGyD5oXAezc=')
})

test('camera: numero plausibile per hotel, oppure nome/alias di zona', () => {
  assert.equal(findRoom('chocohotel', 'Camera 214 il rubinetto perde'), '214')
  assert.equal(findRoom('chocohotel', 'anno 2024 camera 214'), '214')
  assert.equal(findRoom('brigantino', 'nella 305 non va la luce'), null)
  assert.equal(findRoom('hotelgio', 'stanza 1105 tv rotta'), '1105')
  const locs = [{ name: 'Sala colazioni', aliases: ['colazione'] }, { name: 'Spa', aliases: [] }]
  assert.equal(findRoom('hotelgio', 'in sala colazioni manca la luce', locs), 'Sala colazioni')
  assert.equal(findRoom('hotelgio', 'alla spa perde acqua', locs), 'Spa')
  assert.equal(findRoom('hotelgio', 'cose a caso', locs), null)
  assert.ok(plausibleRoom('chocohotel', '314') && !plausibleRoom('chocohotel', '114'))
})

test('categoria e urgenza usano solo valori ammessi da RandApp', () => {
  const samples = ['rubinetto che perde', 'la luce non va', 'aria condizionata rotta', 'finestra bloccata', 'letto rotto', 'infiltrazione nel muro', 'boh']
  for (const s of samples) assert.ok(CATEGORIES.includes(categoryFrom(s)), s)
  assert.equal(categoryFrom('rubinetto che perde'), 'Idraulica')
  assert.equal(categoryFrom('boh'), 'Altro')
  const ok = ['bassa', 'normale', 'alta', 'urgente']
  for (const s of ['allagamento', 'urgente porta', 'quando possibile', 'normale']) assert.ok(ok.includes(urgencyFrom(s)), s)
  assert.equal(urgencyFrom('c\'è un allagamento'), 'urgente')
  assert.equal(urgencyFrom('la porta non si chiude'), 'alta')
  assert.equal(urgencyFrom('lampadina, quando possibile'), 'bassa')
})

test('titolo: prima riga, massimo 140 caratteri', () => {
  assert.equal(titleFrom('Prima riga\nseconda', '101'), 'Prima riga')
  assert.equal(titleFrom('', '101'), 'Segnalazione 101')
  assert.equal(titleFrom('x'.repeat(300), null).length, 140)
})

test('foto: il formato si riconosce dai byte, non dal tipo dichiarato', () => {
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
  assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png')
  assert.equal(sniffImage(new Uint8Array([0x3c, 0x73, 0x76, 0x67])), null)
})

test('funzione: firma obbligatoria, canale spento = niente scritture, nessun segreto nel codice', () => {
  const src = readFileSync(new URL('../supabase/functions/randapp-whatsapp-inbound/index.ts', import.meta.url), 'utf8')
  assert.match(src, /validSignature/)
  assert.ok(src.indexOf('Forbidden') < src.indexOf('from randapp.whatsapp_channels'), 'la firma si controlla prima di leggere il database')
  assert.match(src, /!channel\.enabled\) return twiml/)
  assert.doesNotMatch(src, /TWILIO_AUTH_TOKEN\s*=\s*["']/)
})
