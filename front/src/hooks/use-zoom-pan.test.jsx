// @vitest-environment jsdom
import { useRef } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ZOOM_MAX, ZOOM_MIN, useZoomPan } from './use-zoom-pan.js'

// jsdom ne calcule aucune mise en page : la zone et le contenu reçoivent des rectangles fixes.
function Harness({ onCellClick }) {
  const stageRef = useRef(null)
  const contentRef = useRef(null)
  const { zoom, dragging, zoomIn, zoomOut, overview } = useZoomPan({ stageRef, contentRef })
  return (
    <>
      <div ref={stageRef} data-testid="stage" tabIndex={0}>
        <div ref={contentRef} data-testid="content" onClick={onCellClick} />
      </div>
      <output data-testid="zoom">{zoom}</output>
      <output data-testid="dragging">{String(dragging)}</output>
      <button type="button" onClick={zoomIn}>plus</button>
      <button type="button" onClick={zoomOut}>moins</button>
      <button type="button" onClick={overview}>ensemble</button>
    </>
  )
}

const zoom = () => Number(screen.getByTestId('zoom').textContent)
const pointer = (type, init) => new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', pointerId: 1, ...init })

beforeEach(() => {
  // PointerEvent manque à jsdom : MouseEvent porte les coordonnées, on y ajoute l'identifiant et le type.
  if (!globalThis.PointerEvent) {
    globalThis.PointerEvent = class extends MouseEvent {
      constructor(type, init = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 1
        this.pointerType = init.pointerType ?? 'mouse'
      }
    }
  }
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100 })
  // 1024 × 768 dans jsdom : la toile couvre l'écran au départ, soit un zoom de 1024 / 768.
  window.innerWidth = 1024
  window.innerHeight = 768
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('part d’un zoom qui couvre l’écran, puis zoome, dézoome et revient à la vue d’ensemble', () => {
  render(<Harness />)
  expect(zoom()).toBeCloseTo(1024 / 768)
  fireEvent.click(screen.getByText('plus'))
  expect(zoom()).toBeCloseTo((1024 / 768) * 1.5)
  fireEvent.click(screen.getByText('ensemble'))
  expect(zoom()).toBe(1)
  fireEvent.click(screen.getByText('moins'))
  expect(zoom()).toBeCloseTo(1 / 1.5)
})

it('dézoome sous la vue d’ensemble à la molette, sans dépasser les bornes', () => {
  render(<Harness />)
  const stage = screen.getByTestId('stage')
  for (let i = 0; i < 40; i++) fireEvent.wheel(stage, { deltaY: 200, clientX: 50, clientY: 50 })
  expect(zoom()).toBe(ZOOM_MIN)
  for (let i = 0; i < 80; i++) fireEvent.wheel(stage, { deltaY: -200, clientX: 50, clientY: 50 })
  expect(zoom()).toBe(ZOOM_MAX)
})

it('zoome au clavier quand la zone a le focus', () => {
  render(<Harness />)
  const stage = screen.getByTestId('stage')
  fireEvent.keyDown(stage, { key: '0' })
  expect(zoom()).toBe(1)
  fireEvent.keyDown(stage, { key: '+' })
  expect(zoom()).toBeCloseTo(1.5)
  fireEvent.keyDown(stage, { key: '-' })
  expect(zoom()).toBeCloseTo(1)
})

it('déplace la zone au glisser, et ce glisser ne compte pas comme un clic', () => {
  const onCellClick = vi.fn()
  render(<Harness onCellClick={onCellClick} />)
  const stage = screen.getByTestId('stage')
  const content = screen.getByTestId('content')
  stage.scrollLeft = 200
  stage.scrollTop = 200
  act(() => {
    content.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }))
    content.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 70 }))
  })
  expect(screen.getByTestId('dragging').textContent).toBe('true')
  expect([stage.scrollLeft, stage.scrollTop]).toEqual([240, 230])
  act(() => content.dispatchEvent(pointer('pointerup', { clientX: 60, clientY: 70 })))
  fireEvent.click(content)
  expect(onCellClick).not.toHaveBeenCalled()
  expect(screen.getByTestId('dragging').textContent).toBe('false')
})

it('laisse passer un clic sans déplacement : il pose un pixel', () => {
  const onCellClick = vi.fn()
  render(<Harness onCellClick={onCellClick} />)
  const content = screen.getByTestId('content')
  act(() => {
    content.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }))
    content.dispatchEvent(pointer('pointermove', { clientX: 102, clientY: 101 }))
    content.dispatchEvent(pointer('pointerup', { clientX: 102, clientY: 101 }))
  })
  fireEvent.click(content)
  expect(onCellClick).toHaveBeenCalledTimes(1)
})

it('zoome au pincement à deux doigts', () => {
  render(<Harness />)
  const content = screen.getByTestId('content')
  fireEvent.click(screen.getByText('ensemble'))
  act(() => {
    content.dispatchEvent(pointer('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 50 }))
    content.dispatchEvent(pointer('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 60, clientY: 50 }))
    content.dispatchEvent(pointer('pointermove', { pointerId: 2, pointerType: 'touch', clientX: 80, clientY: 50 }))
  })
  // Les doigts passent de 20 à 40 px d'écart : le zoom double.
  expect(zoom()).toBeCloseTo(2)
})
