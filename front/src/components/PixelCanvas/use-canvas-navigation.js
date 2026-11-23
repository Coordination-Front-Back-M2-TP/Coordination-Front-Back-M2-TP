import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

// Zoom 1 : toute la toile tient à l'écran (« Vue d'ensemble »). En dessous, elle rapetisse encore pour la voir de loin.
const OVERVIEW_ZOOM = 1
const MIN_ZOOM = 0.25
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

// Zoom de départ : la toile couvre tout l'écran (maquette A), elle déborde sur le côté le plus court.
function coverZoom() {
  if (typeof window === 'undefined' || !window.innerWidth || !window.innerHeight) return OVERVIEW_ZOOM
  const { innerWidth: width, innerHeight: height } = window
  return Math.min(MAX_ZOOM, Math.max(width, height) / Math.min(width, height))
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
  const [zoom, setZoom] = useState(coverZoom)
  const currentZoom = useRef(zoom)

  const changeView = useCallback((viewport, targetZoom, from, to = from) => {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetZoom))
    const ratio = next / currentZoom.current
    // Plus petite que l'écran, la toile est centrée par une marge : on la retire pour viser le bon point.
    const content = viewport.firstElementChild
    const offset = () => ({ x: content?.offsetLeft ?? 0, y: content?.offsetTop ?? 0 })
    const before = offset()
    const pointX = viewport.scrollLeft + from.x - before.x
    const pointY = viewport.scrollTop + from.y - before.y

    // La taille doit changer avant le défilement pour que le navigateur applique les nouvelles limites.
    if (ratio !== 1) {
      viewport.style.setProperty('--canvas-zoom', next)
      currentZoom.current = next
      setZoom(next)
    }
    const after = offset()
    viewport.scrollLeft = after.x + pointX * ratio - to.x
    viewport.scrollTop = after.y + pointY * ratio - to.y
  }, [])

  // Au premier affichage, la toile est centrée : on voit son milieu, origine (0, 0) comprise.
  const centered = useRef(false)
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!enabled || !viewport || centered.current) return
    centered.current = true
    viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2
    viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2
  }, [enabled])

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
    // + et - zooment, 0 revient à la vue d'ensemble.
    const zoomKeys = { '+': ZOOM_STEP, '=': ZOOM_STEP, '-': 1 / ZOOM_STEP }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && (zoomKeys[event.key] || event.key === '0')) {
      event.preventDefault()
      const viewport = event.currentTarget
      changeView(viewport, event.key === '0' ? OVERVIEW_ZOOM : currentZoom.current * zoomKeys[event.key], center(viewport))
      return
    }
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
    zoom,
    isOverview: zoom === OVERVIEW_ZOOM,
    canZoomIn: zoom < MAX_ZOOM,
    canZoomOut: zoom > MIN_ZOOM,
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(1 / ZOOM_STEP),
    reset: () => {
      const viewport = viewportRef.current
      changeView(viewport, OVERVIEW_ZOOM, center(viewport))
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
