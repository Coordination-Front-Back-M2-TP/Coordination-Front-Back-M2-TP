-- SQLite demande de recréer la table pour changer la valeur par défaut d'une colonne.
BEGIN;

CREATE TABLE "new_CanvasState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 250,
    "height" INTEGER NOT NULL DEFAULT 250
);

INSERT INTO "new_CanvasState" ("id", "revision", "width", "height")
SELECT "id", "revision",
       CASE WHEN "width" = 101 AND "height" = 101 THEN 250 ELSE "width" END,
       CASE WHEN "width" = 101 AND "height" = 101 THEN 250 ELSE "height" END
FROM "CanvasState";

DROP TABLE "CanvasState";
ALTER TABLE "new_CanvasState" RENAME TO "CanvasState";

COMMIT;
