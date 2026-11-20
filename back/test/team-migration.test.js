import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import Database from 'better-sqlite3'

test('la migration des équipes conserve les comptes, sessions et poses existants', () => {
  const db = new Database(':memory:')
  try {
    db.exec(`CREATE TABLE Account (id INTEGER PRIMARY KEY, teamId TEXT);
      CREATE TABLE Session (id INTEGER PRIMARY KEY, accountId INTEGER);
      CREATE TABLE PixelPlacement (id INTEGER PRIMARY KEY, teamId TEXT);
      INSERT INTO Account VALUES (1, 'rouge');
      INSERT INTO Session VALUES (1, 1);
      INSERT INTO PixelPlacement VALUES (1, 'bleue'), (2, NULL);`)
    const sql = readFileSync(new URL('../prisma/migrations/20261120150000_create_teams/migration.sql', import.meta.url), 'utf8')
    db.exec(sql)
    assert.deepEqual(db.prepare('SELECT teamId FROM Account').get(), { teamId: 'rouge' })
    assert.deepEqual(db.prepare('SELECT accountId FROM Session').get(), { accountId: 1 })
    assert.deepEqual(db.prepare('SELECT teamId FROM PixelPlacement ORDER BY id').all(), [{ teamId: 'bleue' }, { teamId: null }])
    assert.deepEqual(db.prepare('SELECT id FROM Team ORDER BY sequence').all().map((team) => team.id), ['rouge', 'bleue', 'verte', 'jaune'])
  } finally {
    db.close()
  }
})
