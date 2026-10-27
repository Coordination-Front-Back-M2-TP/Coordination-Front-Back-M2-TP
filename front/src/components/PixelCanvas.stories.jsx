import { parseCanvasSnapshot } from '../api/canvas-state.js'
import { PixelCanvas } from './PixelCanvas.jsx'

const snapshot = {
  width: 7,
  height: 7,
  revision: 3,
  snapshotAt: '2026-10-27T14:30:00.000Z',
  pixels: [
    { x: -3, y: -3, color: '#D93A3A', revision: 1, updatedAt: '2026-10-27T14:30:00.000Z' },
    { x: 0, y: 0, color: '#2563EB', revision: 2, updatedAt: '2026-10-27T14:30:00.000Z' },
    { x: 3, y: 3, color: '#22C55E', revision: 3, updatedAt: '2026-10-27T14:30:00.000Z' },
  ],
}

export const PixelsExistants = () => <PixelCanvas canvas={parseCanvasSnapshot(snapshot)} />
export const ToileVide = () => <PixelCanvas canvas={parseCanvasSnapshot({ ...snapshot, revision: 0, pixels: [] })} />
