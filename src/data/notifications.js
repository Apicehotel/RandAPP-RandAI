import { supabase } from '../lib/supabase.js'
import { urlBase64ToBytes, webPushSupported } from '../lib/notifications.js'

// Tutto filtrato per struttura e utente; la RLS lo impone comunque (si vedono solo le proprie).
const COLUMNS = 'id,hotel_id,kind,title,body,link,priority,created_at,read_at'

export async function listNotifications(hotelId, userId, limit = 100) {
  const { data, error } = await supabase.from('notifications').select(COLUMNS)
    .eq('hotel_id', hotelId).eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
  if (error) throw new Error('Impossibile caricare le notifiche')
  return data || []
}

export async function countUnread(hotelId, userId) {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true })
    .eq('hotel_id', hotelId).eq('user_id', userId).is('read_at', null)
  if (error) throw new Error('Impossibile contare le notifiche')
  return count || 0
}

export async function markRead(hotelId, userId, ids) {
  if (!ids.length) return
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() })
    .eq('hotel_id', hotelId).eq('user_id', userId).in('id', ids).is('read_at', null)
  if (error) throw new Error('Impossibile segnare come letta')
}

export async function markAllRead(hotelId, userId) {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() })
    .eq('hotel_id', hotelId).eq('user_id', userId).is('read_at', null)
  if (error) throw new Error('Impossibile segnare come lette')
}

// ---- Preferenze per tipo e canale
export async function listPrefs(hotelId, userId) {
  const { data, error } = await supabase.from('notification_prefs').select('kind,ntfy,push,whatsapp')
    .eq('hotel_id', hotelId).eq('user_id', userId)
  if (error) throw new Error('Impossibile caricare le preferenze')
  return data || []
}
export async function setPref(hotelId, userId, kind, channel, value) {
  const { error } = await supabase.from('notification_prefs')
    .upsert({ user_id: userId, hotel_id: hotelId, kind, [channel]: value }, { onConflict: 'user_id,hotel_id,kind' })
  if (error) throw new Error('Impossibile salvare la preferenza')
}

// ---- Canali della struttura (li accende chi ha notifications.manage)
export async function listChannels(hotelId) {
  const { data, error } = await supabase.from('notification_channels').select('channel,enabled').eq('hotel_id', hotelId)
  if (error) throw new Error('Impossibile caricare i canali')
  return data || []
}
export async function setChannel(hotelId, channel, enabled) {
  const { error } = await supabase.from('notification_channels').upsert({ hotel_id: hotelId, channel, enabled }, { onConflict: 'hotel_id,channel' })
  if (error) throw new Error('Impossibile aggiornare il canale')
}
export async function sendTest(hotelId) {
  const { error } = await supabase.rpc('notify_test', { p_hotel: hotelId })
  if (error) throw new Error('Impossibile inviare la notifica di prova')
}

// ---- Destinazioni dell'utente (telefono, ntfy, WhatsApp; in futuro app Android/iOS)
export async function listDevices(hotelId, userId) {
  const { data, error } = await supabase.from('notification_devices').select('id,hotel_id,platform,token,label,active')
    .eq('hotel_id', hotelId).eq('user_id', userId)
  if (error) throw new Error('Impossibile caricare i dispositivi')
  return data || []
}
export async function saveDevice({ hotelId, userId, platform, token, keys = null, label = null }) {
  const { data, error } = await supabase.from('notification_devices')
    .upsert({ user_id: userId, hotel_id: hotelId, platform, token, keys, label }, { onConflict: 'user_id,hotel_id,platform,token' })
    .select('id,platform,token,label,active').single()
  if (error) throw new Error('Impossibile salvare il dispositivo')
  // Il salvataggio su un dispositivo già noto lo riattiva.
  if (data && data.active === false) await setDeviceActive(hotelId, data.id, true)
  return data
}
export async function setDeviceActive(hotelId, id, active) {
  const { error } = await supabase.from('notification_devices').update({ active })
    .eq('hotel_id', hotelId).eq('id', id)
  if (error) throw new Error('Impossibile aggiornare il dispositivo')
}

// ---- Push del browser
export const vapidKey = () => import.meta.env?.VITE_VAPID_PUBLIC_KEY || ''

export async function currentWebToken() {
  if (!webPushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration('./sw.js').catch(() => null)
  const sub = await reg?.pushManager.getSubscription().catch(() => null)
  return sub?.endpoint || null
}

export async function enableWebPush(hotelId, userId) {
  if (!webPushSupported()) throw new Error('Questo browser non supporta le notifiche')
  if (!vapidKey()) throw new Error('Le notifiche del telefono non sono ancora configurate sul server')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permesso negato: abilita le notifiche per questo sito nelle impostazioni del browser')
  const reg = await navigator.serviceWorker.register('./sw.js')
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(vapidKey()) }))
  const json = sub.toJSON()
  return saveDevice({ hotelId, userId, platform: 'web', token: sub.endpoint, keys: json.keys || null, label: 'Browser' })
}

export async function disableWebPush(device) {
  const reg = await navigator.serviceWorker.getRegistration('./sw.js').catch(() => null)
  const sub = await reg?.pushManager.getSubscription().catch(() => null)
  await sub?.unsubscribe().catch(() => {})
  if (device) await setDeviceActive(device.hotel_id, device.id, false)
}
