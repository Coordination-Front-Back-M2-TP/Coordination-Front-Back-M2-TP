CREATE TABLE "PixelPlacement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "placedAt" DATETIME NOT NULL,
    "revision" INTEGER NOT NULL
);

CREATE UNIQUE INDEX "PixelPlacement_revision_key" ON "PixelPlacement"("revision");
CREATE INDEX "PixelPlacement_placedAt_idx" ON "PixelPlacement"("placedAt");
