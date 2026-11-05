import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'

// Nessun dato sensibile nel repo: token JWT, chiavi, password/PIN scritti nei file.
const root = new URL('../', import.meta.url).pathname
const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && existsSync(root + f) && !f.endsWith('package-lock.json') && !f.startsWith('test/'))

const PATTERNS = [
  { name: 'JWT', re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'chiave sb_secret', re: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'chiave privata', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'token GitHub', re: /gh[pousr]_[A-Za-z0-9]{30,}/ },
]

test('nessun segreto nei file del progetto', () => {
  assert.ok(files.length > 0)
  for (const file of files) {
    const text = readFileSync(root + file, 'utf8')
    for (const { name, re } of PATTERNS) {
      // Unica eccezione: la chiave Supabase con ruolo "anon" in netlify.toml (pubblica per natura, va nel browser).
      if (name === 'JWT' && file === 'netlify.toml') {
        const all = text.match(new RegExp(re.source, 'g')) || []
        const bad = all.filter((t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).role !== 'anon')
        assert.equal(bad.length, 0, `JWT non anon trovato in ${file}`)
        continue
      }
      assert.doesNotMatch(text, re, `${name} trovato in ${file}`)
    }
  }
})

test('.env non è tracciato', () => {
  assert.ok(!files.includes('.env'))
})
