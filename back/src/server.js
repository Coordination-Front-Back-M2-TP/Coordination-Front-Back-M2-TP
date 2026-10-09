import { app } from './app.js'

// Le front attend le back sur le port 3000 (proxy de front/vite.config.js).
const port = Number(process.env.PORT) || 3000

// Express 5 passe l'erreur d'écoute (port déjà pris…) au callback : sans ce test, le back se dirait prêt.
app.listen(port, (error) => {
  if (error) throw error
  console.log(`Back P1X3L prêt : http://localhost:${port}/api/health`)
})
