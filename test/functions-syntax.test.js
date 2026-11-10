import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, writeFileSync, mkdtempSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Le funzioni edge non passano dal build dell'app: un errore di sintassi lo scopre solo Supabase («failed to bundle function»)
// dopo il push. Qui si controlla prima la sintassi di ogni file (solo sintassi: gli import `npm:` di Deno non si risolvono in Node).
// `node --check` NON analizza i file .ts (dà sempre esito positivo): si tolgono prima i tipi e si controlla il JavaScript che ne esce.
const root = new URL('../supabase/functions/', import.meta.url)

export function syntaxError(source, isTs) {
  let js = source
  if (isTs) {
    try { js = stripTypeScriptTypes(source) } catch (e) { return `SyntaxError: ${String(e.message).split('\n')[0]}` }
  }
  const file = join(mkdtempSync(join(tmpdir(), 'fn-syntax-')), 'check.mjs')
  writeFileSync(file, js)
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
    return null
  } catch (e) {
    return String(e.stderr || e.message).split('\n').filter((l) => /SyntaxError/.test(l)).slice(0, 1).join(' ') || 'errore di sintassi'
  }
}

const files = []
for (const dir of readdirSync(root)) {
  const dirUrl = new URL(`${dir}/`, root)
  if (!statSync(dirUrl).isDirectory()) continue
  for (const f of readdirSync(dirUrl)) if (/\.(ts|js)$/.test(f)) files.push([`${dir}/${f}`, new URL(f, dirUrl)])
}

test('ci sono funzioni da controllare', () => assert.ok(files.length >= 8))

test('il controllo trova davvero un errore (il caso della PR #95: «};» prima di «else»)', () => {
  const broken = 'async function f(plan: string) {\n  if (plan === "a") await g()\n  else if (plan === "b") {\n    await h()\n  };\n  else if (plan === "c") { await i() }\n}\n'
  assert.match(syntaxError(broken, true), /SyntaxError/)
  assert.equal(syntaxError(broken.replace('};', '}'), true), null)
})

for (const [name, url] of files) {
  test(`sintassi valida: ${name}`, () => {
    const err = syntaxError(readFileSync(url, 'utf8'), name.endsWith('.ts'))
    assert.equal(err, null, err || '')
  })
}
