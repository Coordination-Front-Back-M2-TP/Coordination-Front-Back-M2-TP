import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_ZOOM = 1
const MAX_ZOOM = 8
const ZOOM_STEP = 1.25
const DRAG_THRESHOLD = 5
const KEYBOARD_STEP = 40

const KEYBOARD_DIRECTIONS = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
}

function localPoint(viewport, { clientX, clientY }) {
  const rect = viewport.getBoundingClientRect()
  return { x: clientX - rect.left - viewport.clientLeft, y: clientY - rect.top - viewport.clientTop }
}

function center(viewport) {
  return { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 }
}

function midpoint(first, second) {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
}

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

export function useCanvasNavigation(enabled, onTap) {
  const viewportRef = useRef(null)
  const pointers = useRef(new Map())
  const moved = useRef(false)
  const currentZoom = useRef(MIN_ZOOM)
  const [zoom, setZoom] = useState(MIN_ZOOM)

  const changeView = useCallback((viewport, targetZoom, from, to = from) => {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetZoom))
    const ratio = next / currentZoom.current
    const left = (viewport.scrollLeft + from.x) * ratio - to.x
    const top = (viewport.scrollTop + from.y) * ratio - to.y

    // La taille doit changer avant le défilement pour que le navigateur applique les nouvelles limites.
    if (ratio !== 1) {
      viewport.style.setProperty('--canvas-zoom', next)
      currentZoom.current = next
      setZoom(next)
    }
    viewport.scrollLeft = left
    viewport.scrollTop = top
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!enabled || !viewport) return

    function handleWheel(event) {
      if (event.ctrlKey || event.metaKey || event.deltaY === 0) return
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      if ((factor > 1 && currentZoom.current === MAX_ZOOM) ||
          (factor < 1 && currentZoom.current === MIN_ZOOM)) return
      event.preventDefault()
      changeView(viewport, currentZoom.current * factor, localPoint(viewport, event))
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [changeView, enabled])

  function onPointerDown(event) {
    const active = pointers.current
    if (event.button !== 0 || active.size === 2) return
    if (active.size === 0) moved.current = false
    active.set(event.pointerId, localPoint(event.currentTarget, event))
    // Capturer sur la toile conserve la cible du clic lors d'une pose simple.
    event.target.setPointerCapture(event.pointerId)
    if (active.size === 2) moved.current = true
  }

  function onPointerMove(event) {
    const active = pointers.current
    const previous = active.get(event.pointerId)
    if (!previous) return
    const viewport = event.currentTarget
    const point = localPoint(viewport, event)

    if (!moved.current && distance(previous, point) < DRAG_THRESHOLD) return
    moved.current = true
    active.set(event.pointerId, point)

    if (active.size === 2) {
      const other = [...active.values()].find((position) => position !== point)
      const previousDistance = distance(previous, other)
      const factor = previousDistance > 0 ? distance(point, other) / previousDistance : 1
      changeView(viewport, currentZoom.current * factor, midpoint(previous, other), midpoint(point, other))
      return
    }

    changeView(viewport, currentZoom.current, previous, point)
  }

  function endPointer(event) {
    pointers.current.delete(event.pointerId)
  }

  function onPointerUp(event) {
    const start = pointers.current.get(event.pointerId)
    endPointer(event)
    if (event.pointerType !== 'touch' || !start || moved.current) return

    // Le navigateur peut ignorer le clic tactile juste après un geste.
    // Traiter le tap à la levée du doigt et filtrer son éventuel clic de compatibilité.
    moved.current = true
    if (distance(start, localPoint(event.currentTarget, event)) < DRAG_THRESHOLD) onTap(event)
  }

  function onClickCapture(event) {
    if (moved.current && event.detail !== 0) event.stopPropagation()
  }

  function onKeyDown(event) {
    const direction = KEYBOARD_DIRECTIONS[event.key]
    if (!direction) return
    event.preventDefault()
    event.currentTarget.scrollLeft += direction[0] * KEYBOARD_STEP
    event.currentTarget.scrollTop += direction[1] * KEYBOARD_STEP
  }

  function zoomBy(factor) {
    const viewport = viewportRef.current
    changeView(viewport, currentZoom.current * factor, center(viewport))
  }

  return {
    canZoomIn: zoom < MAX_ZOOM,
    canZoomOut: zoom > MIN_ZOOM,
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(1 / ZOOM_STEP),
    reset: () => {
      const viewport = viewportRef.current
      changeView(viewport, MIN_ZOOM, center(viewport))
    },
    viewportProps: {
      ref: viewportRef,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: endPointer,
      onLostPointerCapture: endPointer,
      onClickCapture,
      onKeyDown,
    },
  }
}
