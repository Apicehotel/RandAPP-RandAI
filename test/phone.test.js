import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COUNTRIES, DEFAULT_DIAL, filterCountries, joinPhone, splitPhone } from '../src/lib/phone.js'

test('il prefisso predefinito è +39 e Italia è la prima voce', () => {
  assert.equal(DEFAULT_DIAL, '39')
  assert.deepEqual(COUNTRIES[0], { name: 'Italia', dial: '39' })
})

test('splitPhone: separa prefisso e numero; senza + è Italia', () => {
  assert.deepEqual(splitPhone('+393401234567'), { dial: '39', national: '3401234567' })
  assert.deepEqual(splitPhone('340 123 4567'), { dial: '39', national: '3401234567' })
  assert.deepEqual(splitPhone('0049 151 1234567'), { dial: '49', national: '1511234567' })
  assert.deepEqual(splitPhone('+4915112345678'), { dial: '49', national: '15112345678' })
  assert.deepEqual(splitPhone(''), { dial: '39', national: '' })
  assert.deepEqual(splitPhone(null), { dial: '39', national: '' })
})

test('joinPhone: prefisso + cifre; vuoto toglie il numero', () => {
  assert.equal(joinPhone('39', ' 340 123-4567'), '+393401234567')
  assert.equal(joinPhone('44', ''), '')
  assert.equal(joinPhone('44', 'abc'), '')
})

test('split e join sono inversi', () => {
  for (const v of ['+393401234567', '+4915112345678', '+14155550123', '+447911123456']) {
    const { dial, national } = splitPhone(v)
    assert.equal(joinPhone(dial, national), v)
  }
})

test('ricerca paesi: per nome (senza accenti/maiuscole) e per prefisso', () => {
  assert.ok(filterCountries('germ').some((c) => c.name === 'Germania'))
  assert.ok(filterCountries('PERU').some((c) => c.name === 'Perù'))
  assert.equal(filterCountries('+44')[0].name, 'Gran Bretagna')
  assert.equal(filterCountries('').length, COUNTRIES.length)
  assert.deepEqual(filterCountries('zzzz'), [])
})

test('0028: lo stesso numero può stare su più utenti', () => {
  const dir = fileURLToPath(new URL('../supabase/migrations/', import.meta.url))
  const sql = readFileSync(join(dir, readdirSync(dir).find((f) => f.startsWith('0028'))), 'utf8')
  assert.match(sql, /drop index if exists randapp\.profiles_phone_uidx/)
  assert.doesNotMatch(sql, /create unique index/i)
  assert.doesNotMatch(sql, /errcode = '23505'/)
  assert.match(sql, /distinct on \(i2\.id\)/)
})
