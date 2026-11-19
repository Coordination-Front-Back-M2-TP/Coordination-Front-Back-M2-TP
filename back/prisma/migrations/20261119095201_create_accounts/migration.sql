-- CreateTable
CREATE TABLE "Account" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pseudo" TEXT NOT NULL,
    "pseudoKey" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tokenHash" TEXT NOT NULL,
    "accountId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "Session_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables : PixelPlacement.teamId devient facultatif (joueur sans équipe).
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PixelPlacement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "teamId" TEXT,
    "placedAt" DATETIME NOT NULL,
    "revision" INTEGER NOT NULL
);
INSERT INTO "new_PixelPlacement" ("accountId", "color", "id", "placedAt", "revision", "teamId", "x", "y") SELECT "accountId", "color", "id", "placedAt", "revision", "teamId", "x", "y" FROM "PixelPlacement";
DROP TABLE "PixelPlacement";
ALTER TABLE "new_PixelPlacement" RENAME TO "PixelPlacement";
CREATE UNIQUE INDEX "PixelPlacement_revision_key" ON "PixelPlacement"("revision");
CREATE INDEX "PixelPlacement_accountId_placedAt_idx" ON "PixelPlacement"("accountId", "placedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Account_pseudoKey_key" ON "Account"("pseudoKey");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_accountId_idx" ON "Session"("accountId");
