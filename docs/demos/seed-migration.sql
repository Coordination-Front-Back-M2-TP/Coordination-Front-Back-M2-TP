-- Données de départ pour la démo de migration (docs/demos-oral.md).
-- Le pixel (10, 10) est posé par l'équipe rouge, puis repris par l'équipe bleue.
UPDATE "CanvasState" SET "revision" = 3 WHERE "id" = 1;

INSERT INTO "PixelPlacement" ("x", "y", "color", "accountId", "teamId", "placedAt", "revision") VALUES
  (10, 10, '#E50000', 'alice', 'rouge', '2026-11-19T10:00:00.000Z', 1),
  (10, 10, '#0000EA', 'bob', 'bleu', '2026-11-19T10:01:00.000Z', 2),
  (11, 10, '#E50000', 'alice', 'rouge', '2026-11-19T10:02:00.000Z', 3);

INSERT INTO "Pixel" ("x", "y", "color", "updatedAt", "revision") VALUES
  (10, 10, '#0000EA', '2026-11-19T10:01:00.000Z', 2),
  (11, 10, '#E50000', '2026-11-19T10:02:00.000Z', 3);
