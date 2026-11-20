// Règles du hook commit-msg (.husky/commit-msg), installé par `npm ci` à la racine.
// Elles reprennent celles du contrôle « Titre au format Conventional Commits » (.github/workflows/pr-checks.yml) :
// un commit refusé ici l'aurait été au titre de la PR. Format : CONTRIBUTING.md, section 8.
export default {
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'docs', 'ci', 'chore', 'refactor', 'test', 'style', 'perf', 'build', 'revert']],
    'type-empty': [2, 'never'],
    'type-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
  },
  helpUrl: 'CONTRIBUTING.md, section 8 : type(zone): description, par exemple « feat(front): ajouter la palette de couleurs »',
}
