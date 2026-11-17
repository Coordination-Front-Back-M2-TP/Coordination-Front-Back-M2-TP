import { createServer } from 'node:http'
import { app } from './app.js'
import { attachCanvasSocket } from './realtime/canvas-socket.js'
import { canvasStore } from './services/canvas-store.js'

// Le front attend le back sur le port 3000 (proxy de front/vite.config.js).
const port = Number(process.env.PORT) || 3000

// Socket.IO partage le serveur HTTP d'Express : API et temps réel sont sur le même port.
const server = createServer(app)
attachCanvasSocket(server, canvasStore)

// Express 5 passe l'erreur d'écoute (port déjà pris…) au callback : sans ce test, le back se dirait prêt.
server.listen(port, (error) => {
  if (error) throw error
  console.log(`Back P1X3L prêt : http://localhost:${port}/api/health`)
})
