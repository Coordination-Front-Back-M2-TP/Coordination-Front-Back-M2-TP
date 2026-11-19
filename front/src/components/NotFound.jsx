// Page affichée quand l'adresse ne correspond à aucun écran (erreur 404 côté front).
// Nginx renvoie index.html pour toutes les adresses : c'est donc au front de dire qu'une page n'existe pas.
export function NotFound({ pathname }) {
  return (
    <main>
      <h1>Page introuvable</h1>
      <p>
        L’adresse <code>{pathname}</code> ne correspond à aucune page de P1X3L.
      </p>
      <a href="/">Revenir à la toile</a>
    </main>
  )
}
