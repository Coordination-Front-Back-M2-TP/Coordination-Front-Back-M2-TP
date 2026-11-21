const isRevision = (value) => Number.isSafeInteger(value) && value >= 0
const isDate = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))
const pixelKey = ({ x, y }) => `${x},${y}`

export function parsePixel(pixel) {
  if (!pixel || !Number.isSafeInteger(pixel.x) || !Number.isSafeInteger(pixel.y)
    || typeof pixel.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(pixel.color)
    || !isRevision(pixel.revision) || !isDate(pixel.updatedAt)) {
    throw new Error('Pixel invalide')
  }
  const { x, y, color, revision, updatedAt } = pixel
  return { x, y, color, revision, updatedAt }
}

function isInside(pixel, { width, height }) {
  const column = pixel.x + Math.floor(width / 2)
  const row = pixel.y + Math.floor(height / 2)
  return column >= 0 && column < width && row >= 0 && row < height
}

export function parseCanvasSnapshot(snapshot) {
  if (!snapshot || !Number.isSafeInteger(snapshot.width) || snapshot.width <= 0
    || !Number.isSafeInteger(snapshot.height) || snapshot.height <= 0
    || !isRevision(snapshot.revision) || !isDate(snapshot.snapshotAt) || !Array.isArray(snapshot.pixels)) {
    throw new Error('Instantané invalide')
  }
  const pixels = new Map()
  for (const raw of snapshot.pixels) {
    const pixel = parsePixel(raw)
    const key = pixelKey(pixel)
    if (!isInside(pixel, snapshot) || pixel.revision > snapshot.revision || pixels.has(key)) {
      throw new Error('Instantané incohérent')
    }
    pixels.set(key, pixel)
  }
  const { width, height, revision, snapshotAt } = snapshot
  return { width, height, revision, snapshotAt, baseRevision: revision, pixels, clearedRevisions: new Map() }
}

export function applyPixelUpdate(canvas, raw) {
  const pixel = parsePixel(raw)
  if (!isInside(pixel, canvas)) throw new Error('Pixel hors de la toile')
  const key = pixelKey(pixel)
  const previous = canvas.pixels.get(key)
  const latest = Math.max(canvas.baseRevision, previous?.revision ?? 0, canvas.clearedRevisions.get(key) ?? 0)
  if (pixel.revision <= latest) return canvas
  const pixels = new Map(canvas.pixels)
  pixels.set(key, pixel)
  return { ...canvas, pixels, revision: Math.max(canvas.revision, pixel.revision) }
}

export function parseCanvasClear(event) {
  const { fromX, fromY, toX, toY, revision, clearedAt } = event ?? {}
  if (![fromX, fromY, toX, toY].every(Number.isSafeInteger)
    || fromX > toX || fromY > toY || !isRevision(revision) || !isDate(clearedAt)) {
    throw new Error('Nettoyage invalide')
  }
  return { fromX, fromY, toX, toY, revision, clearedAt }
}

export function applyCanvasClear(canvas, raw) {
  const { fromX, fromY, toX, toY, revision } = parseCanvasClear(raw)
  if (!isInside({ x: fromX, y: fromY }, canvas) || !isInside({ x: toX, y: toY }, canvas)) {
    throw new Error('Zone hors de la toile')
  }
  if (revision <= canvas.baseRevision) return canvas

  const clearedRevisions = new Map(canvas.clearedRevisions)
  const pixels = new Map(canvas.pixels)
  let changed = false
  for (let y = fromY; y <= toY; y += 1) {
    for (let x = fromX; x <= toX; x += 1) {
      const key = pixelKey({ x, y })
      if (revision <= (clearedRevisions.get(key) ?? 0)) continue
      // Une pose plus ancienne peut arriver plus tard, même sur une case déjà vide.
      clearedRevisions.set(key, revision)
      if (pixels.get(key)?.revision < revision) pixels.delete(key)
      changed = true
    }
  }
  return changed ? { ...canvas, pixels, clearedRevisions, revision: Math.max(canvas.revision, revision) } : canvas
}
