// Vérifie qu'une description de PR remplit le gabarit .github/pull_request_template.md.
// Appelé par .github/workflows/pr-checks.yml. Fonctions pures : elles se testent sans GitHub.

// Retire les commentaires HTML du gabarit : un exemple en commentaire ne compte pas.
function sansCommentaires(corps) {
  return (corps || '').replace(/<!--[\s\S]*?-->/g, '');
}

// Découpe le corps en sections « ## Titre » : { titre: contenu }.
function sections(corps) {
  const resultat = {};
  for (const bloc of sansCommentaires(corps).split(/^## /m).slice(1)) {
    const [titre, ...lignes] = bloc.split('\n');
    resultat[titre.trim()] = lignes.join('\n').trim();
  }
  return resultat;
}

function section(toutes, debutDuTitre) {
  const titre = Object.keys(toutes).find((t) => t.startsWith(debutDuTitre));
  return titre === undefined ? null : toutes[titre];
}

const cases = (texte, cochee) =>
  [...texte.matchAll(cochee ? /^- \[[xX]\] (.*)$/gm : /^- \[ \] (.*)$/gm)].map((m) => m[1].trim());

// Numéro de l'issue indiquée par « Closes #12 » (ou Fixes, Resolves, Refs), sinon null.
function issueLiee(corps) {
  const trouve = sansCommentaires(corps).match(/\b(?:closes|fixes|resolves|refs)\s+#(\d+)/i);
  return trouve ? Number(trouve[1]) : null;
}

// Liste des corrections à faire. Vide quand la description est complète.
function verifierDescription(titrePr, corps) {
  const erreurs = [];
  const toutes = sections(corps);

  if (!section(toutes, 'Ce que fait cette PR')) {
    erreurs.push('Remplir la section « Ce que fait cette PR ».');
  }

  const types = section(toutes, 'Type de changement');
  if (types === null) {
    erreurs.push('Garder la section « Type de changement » du gabarit.');
  } else {
    const coches = cases(types, true);
    if (coches.length !== 1) {
      erreurs.push(`Cocher un seul type de changement (${coches.length} coché(s)).`);
    } else {
      const typeDuTitre = (titrePr.match(/^(\w+)/) || [])[1];
      const typesCoches = [...coches[0].matchAll(/`(\w+)`/g)].map((m) => m[1]);
      if (!typesCoches.includes(typeDuTitre)) {
        erreurs.push(`Le type coché (${typesCoches.join(', ')}) ne correspond pas au type du titre (${typeDuTitre}).`);
      }
    }
  }

  const fini = section(toutes, 'Définition de « fini »');
  if (fini === null || cases(fini, true).length + cases(fini, false).length === 0) {
    erreurs.push('Garder la section « Définition de « fini » (Definition of Done) » du gabarit, avec ses cases.');
  } else {
    for (const pasFaite of cases(fini, false)) {
      erreurs.push(`Definition of Done, case non cochée : « ${pasFaite} ».`);
    }
  }

  return erreurs;
}

module.exports = { issueLiee, verifierDescription };
