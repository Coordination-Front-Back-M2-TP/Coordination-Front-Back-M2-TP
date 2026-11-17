import { parseCanvasSnapshot } from '../../api/canvas-state.js'
import { PixelPlacer } from './PixelPlacer.jsx'

const canvas = parseCanvasSnapshot({
  width: 7,
  height: 7,
  revision: 1,
  snapshotAt: '2026-10-27T14:30:00.000Z',
  pixels: [{ x: 0, y: 0, color: '#2563EB', revision: 1, updatedAt: '2026-10-27T14:30:00.000Z' }],
})

// Sans back, un clic affiche le message d'échec : la story montre la mise en page, pas une vraie pose.
export const JoueurConnecte = () => <PixelPlacer canvas={canvas} user={{ pseudo: 'sam' }} />
export const Visiteur = () => <PixelPlacer canvas={canvas} user={null} />
