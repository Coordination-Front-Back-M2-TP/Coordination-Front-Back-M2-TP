import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

// Zoom 1 : la toile entière tient à l'écran (« Vue d'ensemble »). En dessous, elle rapetisse encore ;
// au-dessus, elle déborde et se déplace.
export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 8
export const ZOOM_STEP = 1.5
// En dessous de cette distance (en pixels), un appui reste un clic : il pose un pixel au lieu de déplacer la toile.
const DRAG_THRESHOLD = { mouse: 4, pen: 6, touch: 10 }
// Sensibilité de la molette : un cran (≈ 100 px) zoome d'environ 16 %.
const WHEEL_SENSITIVITY = 0.0015
const LINE_HEIGHT_PX = 16

const clamp = (value) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value))
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const middle = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

// Zoom de départ : la toile couvre tout l'écran, comme dans la maquette A.
function coverZoom() {
  if (typeof window === 'undefined' || !window.innerWidth || !window.innerHeight) return 1
  const { innerWidth: width, innerHeight: height } = window
  return clamp(Math.max(width, height) / Math.min(width, height))
}

// Zoom et déplacement d'un contenu dans une zone qui défile :
// molette (et pincement du pavé tactile) autour du curseur, glisser à la souris ou au doigt,
// pincement à deux doigts, et raccourcis clavier (+, -, 0) quand la zone a le focus.
// Le point sous le curseur (ou au centre de l'écran pour les boutons) reste en place pendant le zoom.
export function useZoomPan({ stageRef, contentRef, enabled = true }) {
  const [zoom, setZoom] = useState(coverZoom)
  const [dragging, setDragging] = useState(false)
  const zoomRef = useRef(zoom)
  const anchor = useRef(null)
  const centered = useRef(false)
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const suppressClick = useRef(false)

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  // next : un zoom, ou une fonction du zoom actuel. (clientX, clientY) : le point qui reste fixe.
  const zoomAt = useCallback((next, clientX, clientY) => {
    const stage = stageRef.current
    const content = contentRef.current
    if (stage && content) {
      const box = stage.getBoundingClientRect()
      const x = clientX ?? box.left + stage.clientWidth / 2
      const y = clientY ?? box.top + stage.clientHeight / 2
      const rect = content.getBoundingClientRect()
      if (rect.width && rect.height) {
        anchor.current = { fx: (x - rect.left) / rect.width, fy: (y - rect.top) / rect.height, x, y }
      }
    }
    setZoom((current) => clamp(typeof next === 'function' ? next(current) : next))
  }, [stageRef, contentRef])

  // Après chaque zoom : on fait défiler la zone pour remettre le point d'ancrage sous le curseur.
  // Au premier affichage : on centre la toile.
  useLayoutEffect(() => {
    const stage = stageRef.current
    const content = contentRef.current
    if (!enabled || !stage || !content) return
    if (!centered.current) {
      centered.current = true
      stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2
      stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2
      return
    }
    const target = anchor.current
    anchor.current = null
    if (!target) return
    const rect = content.getBoundingClientRect()
    stage.scrollLeft += rect.left + target.fx * rect.width - target.x
    stage.scrollTop += rect.top + target.fy * rect.height - target.y
  }, [zoom, enabled, stageRef, contentRef])

  useEffect(() => {
    const stage = stageRef.current
    if (!enabled || !stage) return

    function onWheel(event) {
      event.preventDefault()
      const delta = event.deltaMode === 1 ? event.deltaY * LINE_HEIGHT_PX : event.deltaY
      zoomAt((current) => current * Math.exp(-delta * WHEEL_SENSITIVITY), event.clientX, event.clientY)
    }

    function onPointerDown(event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      const [first, second] = [...pointers.current.values()]
      if (second) {
        // Deux doigts : pincement. Il remplace le glisser en cours.
        gesture.current = { type: 'pinch', distance: distance(first, second), zoom: zoomRef.current, moved: true }
        setDragging(true)
      } else {
        gesture.current = {
          type: 'pan', pointerType: event.pointerType, x: event.clientX, y: event.clientY,
          left: stage.scrollLeft, top: stage.scrollTop, moved: false,
        }
      }
    }

    function onPointerMove(event) {
      if (!pointers.current.has(event.pointerId)) return
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      const current = gesture.current
      if (!current) return
      if (current.type === 'pinch') {
        const [first, second] = [...pointers.current.values()]
        if (!second || !current.distance) return
        const center = middle(first, second)
        zoomAt(current.zoom * (distance(first, second) / current.distance), center.x, center.y)
        return
      }
      const dx = event.clientX - current.x
      const dy = event.clientY - current.y
      if (!current.moved) {
        if (Math.hypot(dx, dy) < (DRAG_THRESHOLD[current.pointerType] ?? DRAG_THRESHOLD.mouse)) return
        current.moved = true
        setDragging(true)
        // La capture garde le glisser actif si le pointeur sort de la zone. Elle n'est prise qu'une fois
        // le glisser lancé : sinon le clic partirait vers la zone au lieu de la case visée.
        stage.setPointerCapture?.(event.pointerId)
      }
      stage.scrollLeft = current.left - dx
      stage.scrollTop = current.top - dy
    }

    function onPointerEnd(event) {
      if (!pointers.current.delete(event.pointerId)) return
      if (gesture.current?.moved) suppressClick.current = true
      if (pointers.current.size === 0) {
        gesture.current = null
        setDragging(false)
      } else if (gesture.current?.type === 'pinch') {
        // Un doigt reste posé : il reprend le glisser depuis sa position.
        const [rest] = [...pointers.current.values()]
        gesture.current = { type: 'pan', pointerType: 'touch', x: rest.x, y: rest.y, left: stage.scrollLeft, top: stage.scrollTop, moved: true }
      }
    }

    // Un glisser se termine par un clic : on l'arrête avant qu'il pose un pixel.
    function onClickCapture(event) {
      if (!suppressClick.current) return
      suppressClick.current = false
      event.stopPropagation()
      event.preventDefault()
    }

    function onKeyDown(event) {
      if (event.target !== stage || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === '+' || event.key === '=') zoomAt((current) => current * ZOOM_STEP)
      else if (event.key === '-') zoomAt((current) => current / ZOOM_STEP)
      else if (event.key === '0') zoomAt(1)
      else return
      event.preventDefault()
    }

    stage.addEventListener('wheel', onWheel, { passive: false })
    stage.addEventListener('pointerdown', onPointerDown)
    stage.addEventListener('pointermove', onPointerMove)
    stage.addEventListener('pointerup', onPointerEnd)
    stage.addEventListener('pointercancel', onPointerEnd)
    stage.addEventListener('click', onClickCapture, true)
    stage.addEventListener('keydown', onKeyDown)
    return () => {
      stage.removeEventListener('wheel', onWheel)
      stage.removeEventListener('pointerdown', onPointerDown)
      stage.removeEventListener('pointermove', onPointerMove)
      stage.removeEventListener('pointerup', onPointerEnd)
      stage.removeEventListener('pointercancel', onPointerEnd)
      stage.removeEventListener('click', onClickCapture, true)
      stage.removeEventListener('keydown', onKeyDown)
    }
  }, [enabled, stageRef, zoomAt])

  return {
    zoom,
    dragging,
    zoomIn: () => zoomAt((current) => current * ZOOM_STEP),
    zoomOut: () => zoomAt((current) => current / ZOOM_STEP),
    overview: () => zoomAt(1),
  }
}
