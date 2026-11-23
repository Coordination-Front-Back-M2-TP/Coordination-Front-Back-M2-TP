import { isDate, isInside, isRevision, parsePixel, pixelKey } from './canvas-state.js'

function parseClearedCell(cell) {
  if (!Number.isSafeInteger(cell?.x) || !Number.isSafeInteger(cell?.y)) {
    throw new Error('Case à vider invalide')
  }
  return { x: cell.x, y: cell.y }
}

export function parseCanvasRevert(raw) {
  const { revision, revertedAt, restored, cleared } = raw ?? {}
  if (!isRevision(revision) || !isDate(revertedAt) || !Array.isArray(restored) || !Array.isArray(cleared)) {
    throw new Error('Annulation invalide')
  }
  const pixels = restored.map(parsePixel)
  const cells = cleared.map(parseClearedCell)
  const keys = new Set([...pixels, ...cells].map(pixelKey))
  if (keys.size !== pixels.length + cells.length || pixels.some((pixel) => pixel.revision >= revision)) {
    throw new Error('Annulation incohérente')
  }
  return { revision, revertedAt, restored: pixels, cleared: cells }
}

export function applyCanvasRevert(canvas, raw) {
  const { revision, restored, cleared } = parseCanvasRevert(raw)
  if ([...restored, ...cleared].some((cell) => !isInside(cell, canvas))) {
    throw new Error('Annulation hors de la toile')
  }
  if (revision <= canvas.baseRevision) return canvas

  const pixels = new Map(canvas.pixels)
  const clearedRevisions = new Map(canvas.clearedRevisions)
  let changed = false

  for (const cell of [...restored, ...cleared]) {
    const key = pixelKey(cell)
    const latest = Math.max(pixels.get(key)?.revision ?? 0, clearedRevisions.get(key) ?? 0)
    if (revision <= latest) continue
    // Le pixel restauré garde sa révision historique. La case, elle, a changé lors du bannissement.
    clearedRevisions.set(key, revision)
    if (cell.color) pixels.set(key, cell)
    else pixels.delete(key)
    changed = true
  }

  return changed ? { ...canvas, pixels, clearedRevisions, revision: Math.max(canvas.revision, revision) } : canvas
}
