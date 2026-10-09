#!/usr/bin/env bash
# Déploie une version dans un environnement, puis vérifie que l'application répond.
# Appelé par .github/workflows/cd.yml. Mode d'emploi : docs/deploiement.md.
#
# Variables lues :
#   ENVIRONNEMENT     staging ou production
#   VERSION           ce qui part : le SHA du commit en staging, le tag vX.Y.Z en production
#   DEPLOY_HOOK_URL   adresse du hook de déploiement de l'hébergeur (secret). Absente : rien n'est déployé.
#   APP_URL           adresse publique de l'application (facultative)
#   HEALTHCHECK_URL   adresse interrogée après le déploiement (facultative, APP_URL par défaut)
set -euo pipefail

: "${ENVIRONNEMENT:?ENVIRONNEMENT manquant}"
: "${VERSION:?VERSION manquante}"

ESSAIS=30
PAUSE=10

resume() {
  echo "$1" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
}

if [[ -z "${DEPLOY_HOOK_URL:-}" ]]; then
  echo "::warning::Aucun hébergement branché pour $ENVIRONNEMENT : rien n'a été déployé. Voir docs/deploiement.md."
  resume "**$ENVIRONNEMENT** : rien n'a été déployé, aucun hébergement n'est branché."
  exit 0
fi

echo "Déploiement de $VERSION en $ENVIRONNEMENT"
corps=$(jq -n --arg environnement "$ENVIRONNEMENT" --arg version "$VERSION" --arg sha "${GITHUB_SHA:-}" \
  '{environnement: $environnement, version: $version, sha: $sha}')
curl --fail-with-body --silent --show-error --max-time 60 \
  --request POST --header 'Content-Type: application/json' --data "$corps" \
  "$DEPLOY_HOOK_URL" > /dev/null

url="${HEALTHCHECK_URL:-${APP_URL:-}}"
if [[ -z "$url" ]]; then
  resume "**$ENVIRONNEMENT** : \`$VERSION\` envoyé à l'hébergeur. Aucune adresse à vérifier."
  exit 0
fi

for ((essai = 1; essai <= ESSAIS; essai++)); do
  if curl --fail --silent --output /dev/null --max-time 10 "$url"; then
    echo "L'application répond sur $url"
    resume "**$ENVIRONNEMENT** : \`$VERSION\` déployé, l'application répond sur $url."
    exit 0
  fi
  echo "Essai $essai/$ESSAIS : $url ne répond pas encore, nouvel essai dans $PAUSE s"
  sleep "$PAUSE"
done

echo "::error::$url ne répond pas après le déploiement de $VERSION en $ENVIRONNEMENT."
resume "**$ENVIRONNEMENT** : \`$VERSION\` envoyé, mais $url ne répond pas."
exit 1
