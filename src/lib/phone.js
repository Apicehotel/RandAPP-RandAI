// Prefissi internazionali per il campo numero. Predefinito: Italia (+39).
// Un prefisso può valere più paesi (+1, +7): nell'elenco la voce principale viene prima.
export const DEFAULT_DIAL = '39'

export const COUNTRIES = [
  ['Italia', '39'], ['Albania', '355'], ['Algeria', '213'], ['Argentina', '54'], ['Armenia', '374'], ['Australia', '61'],
  ['Austria', '43'], ['Azerbaigian', '994'], ['Bangladesh', '880'], ['Belgio', '32'], ['Bielorussia', '375'], ['Bolivia', '591'],
  ['Bosnia ed Erzegovina', '387'], ['Brasile', '55'], ['Bulgaria', '359'], ['Cambogia', '855'], ['Canada', '1'], ['Cile', '56'],
  ['Cina', '86'], ['Cipro', '357'], ['Colombia', '57'], ['Corea del Sud', '82'], ['Costa Rica', '506'], ['Croazia', '385'],
  ['Cuba', '53'], ['Danimarca', '45'], ['Ecuador', '593'], ['Egitto', '20'], ['Emirati Arabi Uniti', '971'], ['Estonia', '372'],
  ['Etiopia', '251'], ['Filippine', '63'], ['Finlandia', '358'], ['Francia', '33'], ['Georgia', '995'], ['Germania', '49'],
  ['Ghana', '233'], ['Giappone', '81'], ['Giordania', '962'], ['Gran Bretagna', '44'], ['Grecia', '30'], ['India', '91'],
  ['Indonesia', '62'], ['Iran', '98'], ['Iraq', '964'], ['Irlanda', '353'], ['Islanda', '354'], ['Israele', '972'],
  ['Kazakistan', '7'], ['Kenya', '254'], ['Kosovo', '383'], ['Kuwait', '965'], ['Lettonia', '371'], ['Libano', '961'],
  ['Libia', '218'], ['Lituania', '370'], ['Lussemburgo', '352'], ['Malaysia', '60'], ['Malta', '356'], ['Marocco', '212'],
  ['Messico', '52'], ['Moldavia', '373'], ['Monaco', '377'], ['Montenegro', '382'], ['Nigeria', '234'], ['Norvegia', '47'],
  ['Nuova Zelanda', '64'], ['Paesi Bassi', '31'], ['Pakistan', '92'], ['Panama', '507'], ['Paraguay', '595'], ['Perù', '51'],
  ['Polonia', '48'], ['Portogallo', '351'], ['Qatar', '974'], ['Repubblica Ceca', '420'],
  ['Romania', '40'], ['Russia', '7'], ['San Marino', '378'], ['Arabia Saudita', '966'], ['Senegal', '221'], ['Serbia', '381'],
  ['Singapore', '65'], ['Siria', '963'], ['Slovacchia', '421'], ['Slovenia', '386'], ['Spagna', '34'], ['Stati Uniti', '1'],
  ['Sudafrica', '27'], ['Svezia', '46'], ['Svizzera', '41'], ['Tailandia', '66'], ['Taiwan', '886'], ['Tunisia', '216'],
  ['Turchia', '90'], ['Ucraina', '380'], ['Ungheria', '36'], ['Uruguay', '598'], ['Uzbekistan', '998'], ['Vaticano', '379'],
  ['Venezuela', '58'], ['Vietnam', '84'],
].map(([name, dial]) => ({ name, dial }))

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Ricerca per nome del paese o per prefisso ("ger", "+49", "49"). Query vuota = tutti.
export function filterCountries(query, list = COUNTRIES) {
  const q = norm(query).replace(/^\+/, '')
  if (!q) return list
  return list.filter((c) => norm(c.name).includes(q) || c.dial.startsWith(q))
}

// "+393401234567" -> { dial: '39', national: '3401234567' }. Senza "+" il numero è italiano. Il prefisso più lungo vince.
export function splitPhone(value) {
  const s = String(value || '').replace(/[\s().-]/g, '')
  if (!s) return { dial: DEFAULT_DIAL, national: '' }
  if (s.startsWith('00')) return splitPhone(`+${s.slice(2)}`)
  if (!s.startsWith('+')) return { dial: DEFAULT_DIAL, national: s.replace(/\D/g, '') }
  const digits = s.slice(1).replace(/\D/g, '')
  const dials = [...new Set(COUNTRIES.map((c) => c.dial))].sort((a, b) => b.length - a.length)
  const dial = dials.find((d) => digits.startsWith(d))
  return dial ? { dial, national: digits.slice(dial.length) } : { dial: DEFAULT_DIAL, national: digits }
}

// Prefisso + numero -> "+39340…". Numero vuoto = stringa vuota (toglie il numero). Uno "0" iniziale dopo +39 resta (fissi italiani).
export function joinPhone(dial, national) {
  const n = String(national || '').replace(/\D/g, '')
  return n ? `+${dial}${n}` : ''
}
