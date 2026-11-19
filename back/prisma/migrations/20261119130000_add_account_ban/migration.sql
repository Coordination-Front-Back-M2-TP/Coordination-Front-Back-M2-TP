-- Heure du bannissement du compte ; vide tant qu'il n'est pas banni.
ALTER TABLE "Account" ADD COLUMN "bannedAt" DATETIME;

-- Sert au bannissement : retrouver la pose d'avant sur une case.
CREATE INDEX "PixelPlacement_x_y_revision_idx" ON "PixelPlacement"("x", "y", "revision");
