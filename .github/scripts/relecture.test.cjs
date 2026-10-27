const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const workflow = fs.readFileSync(path.join(__dirname, '../workflows/relecture.yml'), 'utf8');

function scriptFromWorkflow() {
  const lines = workflow.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === 'script: |');
  assert.notEqual(start, -1, 'Le script de relecture doit exister');
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line && !line.startsWith('            ')) break;
    body.push(line.slice(12));
  }
  return body.join('\n');
}

async function checkReviews(reviews, permissions = {}) {
  const failures = [];
  const infos = [];
  const calls = [];
  const github = {
    paginate: async (_endpoint, args) => {
      calls.push({ kind: 'reviews', args });
      return reviews;
    },
    rest: {
      pulls: { listReviews: () => {} },
      repos: {
        getCollaboratorPermissionLevel: async ({ username }) => {
          calls.push({ kind: 'permission', username });
          return { data: { permission: permissions[username] || 'read' } };
        },
      },
    },
  };
  const core = {
    info: (message) => infos.push(message),
    setFailed: (message) => failures.push(message),
  };
  const context = {
    repo: { owner: 'equipe', repo: 'projet' },
    payload: { pull_request: { number: 103, user: { login: 'auteur' } } },
  };
  await vm.runInNewContext(`(async () => {\n${scriptFromWorkflow()}\n})()`, {
    github, core, context,
  });
  return { failures, infos, calls };
}

function review(login, state) {
  return { user: { login, type: 'User' }, state };
}

test('le workflow garde les événements et seulement le droit de lecture', () => {
  assert.match(workflow, /pull_request:\s*\n\s+types: \[opened, reopened, synchronize, ready_for_review\]/);
  assert.match(workflow, /pull_request_review:\s*\n\s+types: \[submitted, edited, dismissed\]/);
  assert.match(workflow, /permissions:\s*\n\s+pull-requests: read\s*\n/);
  assert.doesNotMatch(workflow, /statuses: write|createCommitStatus|secrets\./);
  assert.match(workflow, /name: Relecture approuvée/);
});

test('sans approbation, le job échoue sans écriture', async () => {
  const result = await checkReviews([]);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /En attente de l'approbation/);
  assert.deepEqual(result.calls.map((call) => call.kind), ['reviews']);
});

test('seule l’approbation d’un autre membre avec droit d’écriture compte', async () => {
  const ignored = await checkReviews([
    review('auteur', 'APPROVED'), review('lecteur', 'APPROVED'), review('robot', 'PENDING'),
  ], { auteur: 'write', lecteur: 'read', robot: 'write' });
  assert.equal(ignored.failures.length, 1);
  const approved = await checkReviews([
    review('relecteur', 'APPROVED'), review('relecteur', 'COMMENTED'),
  ], { relecteur: 'write' });
  assert.deepEqual(approved.failures, []);
  assert.match(approved.infos.join(' '), /Approuvée par relecteur/);
});

test('une demande de modifications bloque malgré une autre approbation', async () => {
  const result = await checkReviews([
    review('relecteur', 'APPROVED'), review('bloqueur', 'CHANGES_REQUESTED'),
  ], { relecteur: 'write', bloqueur: 'maintain' });
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /Modifications demandées par bloqueur/);
});

test('un avis annulé ne bloque plus et un commentaire ne remplace pas l’avis', async () => {
  const result = await checkReviews([
    review('bloqueur', 'CHANGES_REQUESTED'), review('bloqueur', 'DISMISSED'),
    review('relecteur', 'APPROVED'), review('relecteur', 'COMMENTED'),
  ], { bloqueur: 'write', relecteur: 'write' });
  assert.deepEqual(result.failures, []);
  assert.match(result.infos.join(' '), /Approuvée par relecteur/);
});
