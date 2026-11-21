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

test('génère un modèle et place son aperçu transparent sur la toile', async ({ page }) => {
  const quota = { limit: 5, remaining: 2, resetsAt: new Date(Date.now() + 60_000).toISOString() }
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: {
    user: { pseudo: 'Artiste', team: { id: 'rouge', name: 'Rouge', color: '#D93A3A' } },
  } }))
  await page.route('**/api/models/quota', (route) => route.fulfill({ json: {
    quota, moderationProviders: ['jev', 'openai'],
  } }))
  await page.route('**/api/models', (route) => {
    expect(route.request().postDataJSON()).toEqual({ prompt: 'Un éclair', moderationProvider: 'openai' })
    return route.fulfill({ json: {
      model: { width: 2, height: 2, pixels: [{ x: 0, y: 0, color: '#FACC15' }] },
      quota: { ...quota, remaining: 1 },
    } })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Demander un modèle à l’IA' }).click()
  await expect(page.getByText('Modèles disponibles aujourd’hui : 2 sur 5.')).toBeVisible()
  await page.getByRole('textbox', { name: 'Consigne du modèle' }).fill('Un éclair')
  await page.getByRole('combobox', { name: 'Vérification de la consigne' }).selectOption('openai')
  await page.getByRole('button', { name: 'Générer le modèle' }).click()
  await page.getByRole('button', { name: 'Déplacer le modèle vers la droite' }).click()
  await page.getByRole('button', { name: 'Valider le placement' }).click()
  await expect(page.getByText('Modèle placé en (0, -1).')).toBeVisible()
  await expect(page.getByText('Modèles disponibles aujourd’hui : 1 sur 5.')).toBeVisible()

  const opacity = await page.locator('canvas').evaluate((element) => {
    const center = Math.floor(element.width / 2)
    const top = Math.floor(element.height / 2) - 1
    const { data } = element.getContext('2d').getImageData(center, top, 2, 1)
    return [data[3], data[7]]
  })
  expect(opacity[0]).toBeGreaterThan(0)
  expect(opacity[0]).toBeLessThan(255)
  expect(opacity[1]).toBe(0)
})
