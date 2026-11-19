import App from './App.jsx'
import { NotFound } from './components/NotFound.jsx'

// Adresses qui mènent à la toile. Toute autre adresse affiche la page introuvable.
const KNOWN_PATHS = new Set(['/', '/index.html'])

export function Root({ pathname = window.location.pathname }) {
  return KNOWN_PATHS.has(pathname) ? <App /> : <NotFound pathname={pathname} />
}
