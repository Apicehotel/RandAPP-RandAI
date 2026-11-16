import { sirenNotes } from './urgent.js'

// Un solo contesto audio per tutta l'app: il browser lo tiene «sospeso» finché non c'è un tocco della persona,
// quindi lo si sblocca al primo tocco e poi lo si riusa (crearne uno nuovo a ogni suono non suonerebbe mai su telefono).
let audio = null

export function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    audio = audio || new Ctx()
    if (audio.state === 'suspended') audio.resume()
  } catch { /* audio non disponibile: resta la vibrazione */ }
}

export function playSiren() {
  try {
    if (navigator.vibrate) navigator.vibrate([180, 100, 180, 100, 300])
  } catch { /* non supportata */ }
  if (!audio || audio.state !== 'running') return false
  const t0 = audio.currentTime
  for (const n of sirenNotes()) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'square'
    osc.frequency.value = n.freq
    gain.gain.setValueAtTime(0.0001, t0 + n.at)
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + n.at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur)
    osc.connect(gain).connect(audio.destination)
    osc.start(t0 + n.at)
    osc.stop(t0 + n.at + n.dur + 0.02)
  }
  return true
}
