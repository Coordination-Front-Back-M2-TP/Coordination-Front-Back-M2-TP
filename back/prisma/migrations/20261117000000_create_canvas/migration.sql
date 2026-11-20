CREATE TABLE "CanvasState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "revision" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "Pixel" (
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "revision" INTEGER NOT NULL,

    PRIMARY KEY ("x", "y")
);

CREATE UNIQUE INDEX "Pixel_revision_key" ON "Pixel"("revision");
CREATE INDEX "Pixel_y_x_idx" ON "Pixel"("y", "x");

INSERT INTO "CanvasState" ("id", "revision") VALUES (1, 0);
