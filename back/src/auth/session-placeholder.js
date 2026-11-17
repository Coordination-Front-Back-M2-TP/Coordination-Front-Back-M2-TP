import { unauthorized } from '../errors/app-error.js'

// TEMPORAIRE — à remplacer par le vrai mécanisme de session des issues #18
// (contrat) et #39 (back). En attendant, la pose d'un pixel (#44) vérifie la
// présence d'une session sans pouvoir s'appuyer sur l'authentification réelle.
//
// PROPOSITION à faire valider en revue, en attente du contrat #18 : la session
// est transmise par l'en-tête HTTP `X-Session-Id`. Toute valeur non vide donne
// accès au compte et à l'équipe de démonstration ci-dessous ; sans en-tête, la
// requête est refusée avec 401 UNAUTHORIZED au format d'erreur contractuel.
// Le mécanisme définitif (cookie signé, jeton…) sera branché ici.
export const SESSION_HEADER = 'x-session-id'

export const DEMO_ACCOUNT = Object.freeze({
  accountId: 'compte-demo',
  teamId: 'equipe-demo',
})

export function sessionPlaceholder(req, res, next) {
  if (!req.get(SESSION_HEADER)) {
    next(unauthorized('Un compte connecté est nécessaire pour poser un pixel.'))
    return
  }

  req.session = { ...DEMO_ACCOUNT }
  next()
}
