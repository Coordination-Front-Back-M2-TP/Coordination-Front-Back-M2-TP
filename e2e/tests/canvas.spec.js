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

const navigation = (page) => page.getByRole('region', { name: 'Navigation sur la toile' })
const viewportScroll = (viewport) => viewport.evaluate(({ scrollLeft, scrollTop }) => [scrollLeft, scrollTop])

async function mockPlayerPlacements(page) {
  const placements = []
  await page.route('**/api/auth/me', (route) => route.fulfill({
    json: { user: { pseudo: 'Sam', team: { id: 'bleu', name: 'Bleu', color: '#2563EB' } } },
  }))
  await page.route('**/api/pixels', (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    const placement = route.request().postDataJSON()
    placements.push(placement)
    const pixel = contract.placePixel(placement)
    return route.fulfill({ status: 201, json: { pixel, cooldownEndsAt: pixel.updatedAt } })
  })
  return placements
}

test('navigue à la souris et au clavier en 800 × 600 sans poser pendant un glissement', async ({ page }) => {
  const placements = await mockPlayerPlacements(page)
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Poser le pixel' })).toBeEnabled()

  const viewport = navigation(page)
  const zoomIn = page.getByRole('button', { name: 'Zoomer', exact: true })
  await zoomIn.scrollIntoViewIfNeeded()
  await expect(zoomIn).toBeInViewport({ ratio: 1 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(800)
  await zoomIn.click()
  await expect(page.getByRole('button', { name: 'Dézoomer' })).toBeEnabled()
  const board = viewport.getByRole('img')
  await viewport.scrollIntoViewIfNeeded()
  const frame = await viewport.boundingBox()
  const x = frame.x + frame.width / 2
  const y = frame.y + frame.height / 2

  const initial = await viewportScroll(viewport)
  await page.mouse.move(x, y)
  await page.mouse.wheel(0, -100)
  await expect.poll(async () => (await viewportScroll(viewport))[0]).toBeGreaterThan(initial[0])

  const beforeDrag = await viewportScroll(viewport)
  await page.mouse.down()
  await page.mouse.move(x - 30, y - 25, { steps: 5 })
  await page.mouse.up()
  await expect.poll(() => viewportScroll(viewport)).toEqual([beforeDrag[0] + 30, beforeDrag[1] + 25])

  await viewport.focus()
  await viewport.press('ArrowLeft')
  await expect.poll(async () => (await viewportScroll(viewport))[0]).toBe(beforeDrag[0] - 10)

  const zoomed = await board.boundingBox()
  expect(zoomed.width).toBeGreaterThan(frame.width)
  // Clique sur une case connue après le zoom et le déplacement.
  await page.mouse.click(zoomed.x + zoomed.width * 47.5 / 101, zoomed.y + zoomed.height * 52.5 / 101)
  await expect(page.getByText(/Pixel .* posé en \(-3, 2\)/)).toBeVisible()
  expect(placements.map(({ x, y }) => [x, y])).toEqual([[-3, 2]])

  await page.getByRole('button', { name: 'Vue d’ensemble' }).click()
  await expect.poll(() => viewportScroll(viewport)).toEqual([0, 0])
  // À la vue d'ensemble, on peut encore dézoomer pour voir la toile de plus loin.
  await expect(page.getByRole('button', { name: 'Vue d’ensemble' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Dézoomer' })).toBeEnabled()
})

test.describe('sur un écran tactile', () => {
  test.use({ viewport: { width: 390, height: 640 }, hasTouch: true, isMobile: true })

  test('zoome par pincement et parcourt la toile avec un doigt', async ({ page, context }) => {
    const placements = await mockPlayerPlacements(page)
    await page.goto('/')
    // Sur téléphone, la saisie par coordonnées est repliée : la palette prête signale que la pose est possible.
    await expect(page.getByRole('radio', { name: 'Noir' })).toBeEnabled()
    const viewport = navigation(page)
    await viewport.scrollIntoViewIfNeeded()
    const frame = await viewport.boundingBox()
    const x = Math.round(frame.x + frame.width / 2)
    const y = Math.round(frame.y + frame.height / 2)
    const touch = await context.newCDPSession(page)
    const send = (type, touchPoints) => touch.send('Input.dispatchTouchEvent', { type, touchPoints })

    // Sur téléphone, les boutons de zoom sont dans le menu : on vérifie le pincement par la taille de la toile.
    const boardWidth = async () => (await viewport.getByRole('img').boundingBox()).width
    const widthBeforePinch = await boardWidth()
    await send('touchStart', [{ id: 1, x: x - 35, y }, { id: 2, x: x + 35, y }])
    await send('touchMove', [{ id: 1, x: x - 80, y }, { id: 2, x: x + 80, y }])
    await send('touchEnd', [])
    await expect.poll(boardWidth).toBeGreaterThan(widthBeforePinch)

    const beforeDrag = await viewportScroll(viewport)
    await send('touchStart', [{ id: 1, x, y }])
    await send('touchMove', [{ id: 1, x: x - 32, y: y - 22 }])
    await send('touchEnd', [])
    await expect.poll(() => viewportScroll(viewport)).toEqual([beforeDrag[0] + 32, beforeDrag[1] + 22])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)

    const board = await viewport.getByRole('img').boundingBox()
    const targetX = board.x + board.width * 53.5 / 101
    const targetY = board.y + board.height * 52.5 / 101
    await send('touchStart', [{ id: 1, x: Math.round(targetX), y: Math.round(targetY) }])
    await send('touchEnd', [])
    await expect(page.getByText(/Pixel .* posé en \(3, 2\)/)).toBeVisible()
    expect(placements.map(({ x, y }) => [x, y])).toEqual([[3, 2]])
  })
})
