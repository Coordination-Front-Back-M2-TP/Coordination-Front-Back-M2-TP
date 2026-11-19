-- Agent de dessin d'un compte : une ligne tant qu'il travaille, supprimée à l'arrêt.
-- La clé est le compte : un seul modèle actif par compte. pixels est le modèle, en JSON.
CREATE TABLE "DrawingAgent" (
    "accountId" INTEGER NOT NULL PRIMARY KEY,
    "pixels" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL
);
