import { expect, test } from '@playwright/test'
import { createContractServer } from '../contract-server.js'

let contract

test.beforeAll(async () => {
  contract = createContractServer()
  await contract.listen(3000)
})

test.afterAll(async () => {
  await contract.close()
})

test('importe un modèle, retrouve l’agent en cours et rétablit la pose après son arrêt', async ({ page }) => {
  const team = { id: 'rouge', name: 'Rouge', color: '#D93A3A' }
  const pixels = [{ x: 1, y: 1, color: '#D93A3A' }, { x: 1, y: 2, color: '#D93A3A' }]
  const starts = []
  let agent = null
  let stops = 0
  let placements = 0

  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { pseudo: 'Sam', team, role: 'player' } } }))
  await page.route('**/api/agent', (route) => {
    switch (route.request().method()) {
      case 'POST':
        starts.push(route.request().postDataJSON())
        agent = { status: 'running', total: pixels.length, done: 0 }
        return route.fulfill({ status: 201, json: { agent } })
      case 'DELETE':
        stops += 1
        agent = null
        return route.fulfill({ status: 204 })
      default:
        return route.fulfill({ json: { agent } })
    }
  })
  await page.route('**/api/pixels', (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    placements += 1
    const pixel = contract.placePixel(route.request().postDataJSON())
    return route.fulfill({ status: 201, json: { pixel, cooldownEndsAt: pixel.updatedAt } })
  })

  await page.goto('/')
  const upload = page.getByLabel('Modèle placé (JSON)')
  const sendFile = (content) => upload.setInputFiles({
    name: 'modele.json',
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  })
  const start = page.getByRole('button', { name: 'Lancer l’agent' })
  const place = page.getByRole('button', { name: 'Poser le pixel' })
  const stop = page.getByRole('button', { name: 'Arrêter l’agent' })
  await sendFile('{"pixels":[]}')
  await start.click()
  await expect(page.getByText(/Choisissez un fichier JSON/)).toBeVisible()
  expect(starts).toHaveLength(0)

  await sendFile(JSON.stringify({ pixels }))
  await start.click()
  await expect(stop).toBeVisible()
  await expect(page.getByText('0 / 2 pixels du modèle.')).toBeVisible()
  await expect(start).toHaveCount(0)
  await expect(place).toBeDisabled()
  await page.getByRole('img', { name: /Toile partagée/ }).click()
  expect(placements).toBe(0)

  agent = { ...agent, done: 2 }
  await expect(page.getByText('2 / 2 pixels du modèle.')).toBeVisible()
  await expect(page.getByText(/L’agent reste actif pour réparer/)).toBeVisible()
  await page.reload()
  await expect(stop).toBeVisible()
  await expect(place).toBeDisabled()
  expect(starts).toEqual([{ pixels }])

  await stop.click()
  await expect(start).toBeVisible()
  await expect(place).toBeEnabled()
  await place.click()
  await expect(page.getByText(/Pixel .* posé en/)).toBeVisible()
  expect(placements).toBe(1)
  expect(stops).toBe(1)
})
