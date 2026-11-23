function isInsideAxis(coordinate, size) {
  const index = coordinate + Math.floor(size / 2)
  return index >= 0 && index < size
}

export function isInsideCanvas(x, y, { width, height }) {
  return isInsideAxis(x, width) && isInsideAxis(y, height)
}
