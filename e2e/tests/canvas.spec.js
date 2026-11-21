import { expect, test } from '@playwright/test'
import { SEED_PIXELS, createContractServer } from '../contract-server.js'

// Le serveur contrat remplace le back de la toile (#35 pas encore livré) : il
// écoute sur le port 3000, là où le proxy Vite envoie /api et /socket.io.
let contract

test.beforeAll(async () => {
  contract = createContractServer()
  await contract.listen(3000)
})

test.afterAll(async () => {
  await contract.close()
})

// Le rôle « status » interdit un nom accessible : on filtre sur le texte.
const liveStatus = (page) => page.getByRole('status').filter({ hasText: 'Toile en direct' })

// Lit la couleur du pixel (x, y) dessiné dans le canvas ; null si la case est vide.
function readPixel(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const canvas = document.querySelector('canvas')
    const context = canvas.getContext('2d')
    const column = x + Math.floor(canvas.width / 2)
    const row = y + Math.floor(canvas.height / 2)
    const { data } = context.getImageData(column, row, 1, 1)
    if (data[3] === 0) return null
    const hex = (value) => value.toString(16).padStart(2, '0').toUpperCase()
    return `#${hex(data[0])}${hex(data[1])}${hex(data[2])}`
  }, { x, y })
}

// Critère 1 de la US #15 : sans compte, on voit les pixels déjà posés.
test('affiche les pixels déjà posés, sans compte', async ({ page }) => {
  await page.goto('/')
  await expect(liveStatus(page)).toBeVisible()
  await expect(page.getByText('Nettoyer une zone', { exact: true })).toHaveCount(0)

  // Les pixels seedés sont dessinés dans le canvas du navigateur.
  for (const pixel of SEED_PIXELS) {
    await expect.poll(() => readPixel(page, pixel.x, pixel.y)).toBe(pixel.color)
  }

  // L'alternative textuelle liste les mêmes pixels.
  await page.getByText('Consulter les pixels en texte').click()
  const pixels = page.getByRole('list', { name: 'Coordonnées et couleurs des pixels' })
  for (const pixel of SEED_PIXELS) {
    await expect(pixels).toContainText(`(${pixel.x}, ${pixel.y}) : ${pixel.color}`)
  }

  // La lecture HTTP du contrat renvoie le même instantané.
  const response = await page.request.get('/api/pixels')
  expect(response.ok()).toBe(true)
  expect((await response.json()).pixels).toHaveLength(SEED_PIXELS.length)

  // Aucune authentification n'a été envoyée pour voir la toile.
  expect(contract.handshakes.length).toBeGreaterThan(0)
  for (const handshake of contract.handshakes) {
    expect(handshake.auth).toEqual({})
    expect(handshake.headers.authorization).toBeUndefined()
  }
})

// Critère 2 de la US #15 : un pixel posé ailleurs apparaît en moins d'une seconde.
// Sans la pose (#21), le serveur contrat diffuse directement l'événement.
test('un pixel posé ailleurs apparaît en moins d’une seconde', async ({ page }) => {
  await page.goto('/')
  await expect(liveStatus(page)).toBeVisible()

  const change = { x: 10, y: -10, color: '#0EA5E9' }
  const startedAt = Date.now()
  contract.placePixel(change)
  await expect.poll(() => readPixel(page, change.x, change.y), { timeout: 1_000 }).toBe(change.color)
  expect(Date.now() - startedAt).toBeLessThan(1_000)
})

test('seul un admin peut demander un nettoyage, visible en direct par un joueur', async ({ page, context }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { pseudo: 'Lea', role: 'admin', team: null } } }))
  const observer = await context.newPage()
  await observer.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { pseudo: 'Sam', role: 'player', team: null } } }))
  const requests = []
  await page.route('**/api/moderation/cleanups', (route) => {
    const zone = route.request().postDataJSON()
    requests.push(zone)
    return route.fulfill({ json: contract.cleanZone(zone, 'Lea') })
  })

  await Promise.all([page.goto('/'), observer.goto('/')])
  await expect(liveStatus(page)).toBeVisible()
  await expect(liveStatus(observer)).toBeVisible()
  await expect(observer.getByText('Sam', { exact: true })).toBeVisible()
  await expect(observer.getByText('Nettoyer une zone', { exact: true })).toHaveCount(0)
  await expect.poll(() => readPixel(observer, 0, 0)).toBe('#9333EA')

  await page.getByText('Nettoyer une zone', { exact: true }).click()
  const topLeft = page.getByRole('group', { name: 'Coin supérieur gauche' })
  const bottomRight = page.getByRole('group', { name: 'Coin inférieur droit' })
  await topLeft.getByLabel('X').fill('1')
  await topLeft.getByLabel('Y').fill('-2')
  await bottomRight.getByLabel('X').fill('0')
  await bottomRight.getByLabel('Y').fill('0')
  await page.getByRole('button', { name: 'Vérifier la zone' }).click()
  await expect(page.getByText('La zone doit être comprise dans la toile', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmer le nettoyage' })).toHaveCount(0)

  await topLeft.getByLabel('X').fill('-2')
  await page.getByRole('button', { name: 'Vérifier la zone' }).click()
  await page.getByRole('button', { name: 'Annuler', exact: true }).click()
  expect(requests).toHaveLength(0)
  await page.getByRole('button', { name: 'Vérifier la zone' }).click()
  await page.getByRole('button', { name: 'Confirmer le nettoyage' }).click()

  await expect(page.getByText(/Pixels retirés\s*: 2\. Action n° 1 inscrite au journal/)).toBeVisible()
  expect(requests).toEqual([{ fromX: -2, fromY: -2, toX: 0, toY: 0 }])
  for (const client of [page, observer]) {
    await expect.poll(() => readPixel(client, -2, -2)).toBeNull()
    await expect.poll(() => readPixel(client, 0, 0)).toBeNull()
    await expect.poll(() => readPixel(client, 2, 2)).toBe('#EAB308')
  }
})
