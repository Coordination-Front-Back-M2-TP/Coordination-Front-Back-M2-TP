CREATE TABLE "Team" (
  "sequence" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL
);

CREATE UNIQUE INDEX "Team_id_key" ON "Team"("id");

INSERT INTO "Team" ("id", "name", "color") VALUES
  ('rouge', 'Rouge', '#D93A3A'),
  ('bleue', 'Bleue', '#2F6FDE'),
  ('verte', 'Verte', '#2E9E4F'),
  ('jaune', 'Jaune', '#E5B700');
