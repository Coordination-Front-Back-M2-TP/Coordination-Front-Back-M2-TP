-- Équipe du compte : vide tant que le joueur n'en a pas choisi.
-- teamChangedAt est l'heure du dernier changement, pour le délai entre deux changements.
ALTER TABLE "Account" ADD COLUMN "teamId" TEXT;
ALTER TABLE "Account" ADD COLUMN "teamChangedAt" DATETIME;
