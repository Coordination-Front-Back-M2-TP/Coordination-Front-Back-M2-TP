-- Rôle du compte : « player » par défaut, « admin » pour la modération.
ALTER TABLE "Account" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'player';

-- Journal des actions de modération. adminPseudo garde le pseudo au moment de l'action.
CREATE TABLE "ModerationAction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "adminAccountId" INTEGER NOT NULL,
    "adminPseudo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "details" TEXT NOT NULL
);
