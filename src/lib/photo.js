// Foto dal telefono → JPEG ridotto (lato max 1280 px, ~100-300 KB) pronto per `issue_photos.data_url`.
export const MAX_PHOTO_CHARS = 450_000

// Dimensioni dopo il ridimensionamento: non ingrandisce mai.
export function fitSize(width, height, max = 1280) {
  const k = Math.min(1, max / Math.max(width, height, 1))
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Foto non leggibile')) }
    img.src = url
  })
}

export async function compressPhotoAsDataUrl(file) {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('Scegli una foto')
  const img = await loadImage(file)
  const { width, height } = fitSize(img.naturalWidth, img.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(img, 0, 0, width, height)
  for (const quality of [0.72, 0.6, 0.5, 0.4]) {
    const url = canvas.toDataURL('image/jpeg', quality)
    if (url.length <= MAX_PHOTO_CHARS) return url
  }
  throw new Error('Foto troppo pesante: riprova con una più piccola')
}
