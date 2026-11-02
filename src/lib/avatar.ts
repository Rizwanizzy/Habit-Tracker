/** Hard cap for DECODE safety only: anything ≤ 20 MB is re-encoded to a
 *  512px WebP (tens of KB) by this module, so the input size is storage-
 *  irrelevant; 20 MB just keeps a huge file from choking the decoder.
 *  The OUTPUT cap mirrors the avatars bucket limit (2 MB) as belt-and-braces
 *  — a sane WebP encode can never hit it. */
const MAX_INPUT_BYTES = 20 * 1024 * 1024
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024
const TARGET = 512

function isImage(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true
  return /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(file.name)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read image — the file may be HEIC or damaged. Try a JPEG or PNG.'))
    img.src = src
  })
}

/** Prepare an uploaded image for the avatars bucket: reject non-images and
 *  inputs over 20 MB, center-crop to a square, resize to 512px, and encode
 *  as WebP (post-encode size is checked against the bucket's 2 MB limit,
 *  which a WebP of this size never approaches). Returns the resulting Blob. */
export async function prepareAvatar(file: File): Promise<Blob> {
  if (!file) throw new Error('No file provided')
  if (!isImage(file)) throw new Error('That file is not an image — choose a JPEG, PNG or WebP photo')
  if (file.size > MAX_INPUT_BYTES) throw new Error('Choose an image 20 MB or smaller')

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
    if (blob.size > MAX_OUTPUT_BYTES) {
      throw new Error('The processed image is unexpectedly large — try another photo')
    }
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}
