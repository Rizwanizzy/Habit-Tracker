const MAX_BYTES = 2 * 1024 * 1024
const TARGET = 512

function isImage(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true
  return /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(file.name)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read image'))
    img.src = src
  })
}

/** Prepare an uploaded image for the avatars bucket: reject non-images and
 *  files over 2 MB, center-crop to a square, resize to 512px, and encode as
 *  WebP. Returns the resulting Blob. */
export async function prepareAvatar(file: File): Promise<Blob> {
  if (!file) throw new Error('No file provided')
  if (!isImage(file)) throw new Error('File must be an image')
  if (file.size > MAX_BYTES) throw new Error('Image must be 2 MB or smaller')

  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const width = img.naturalWidth || img.width
    const height = img.naturalHeight || img.height
    const side = Math.min(width, height)
    const sx = Math.floor((width - side) / 2)
    const sy = Math.floor((height - side) / 2)

    const canvas = document.createElement('canvas')
    canvas.width = TARGET
    canvas.height = TARGET
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context is not available')
    ctx.drawImage(img, sx, sy, side, side, 0, 0, TARGET, TARGET)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/webp', 0.9)
    })
    if (!blob) throw new Error('Could not encode image as WebP')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}
