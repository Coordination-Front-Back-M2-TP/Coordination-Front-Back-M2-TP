// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CanvasWorkspace } from './CanvasWorkspace.jsx'

const canvas = { width: 5, height: 5, pixels: new Map() }
const user = { pseudo: 'Pixel', team: { id: 'jaune' } }
const model = {
  width: 2,
  height: 2,
  pixels: [{ x: 0, y: 0, color: '#FACC15' }, { x: 1, y: 1, color: '#000000' }],
}
const quota = (remaining) => ({ limit: 5, remaining, resetsAt: new Date(Date.now() + 60_000).toISOString() })
const access = (remaining, moderationProviders = ['jev', 'openai']) => Response.json({
  quota: quota(remaining), moderationProviders,
})
const submitButton = () => screen.getByRole('button', { name: 'Générer le modèle' })
const prompt = () => screen.getByRole('textbox', { name: 'Consigne du modèle' })
let request
let drawing

beforeEach(() => {
  request = vi.fn()
  vi.stubGlobal('fetch', request)
  drawing = { clearRect: vi.fn(), fillRect: vi.fn(), save: vi.fn(), restore: vi.fn() }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(drawing)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function openForm() {
  render(<CanvasWorkspace canvas={canvas} user={user} />)
  fireEvent.click(screen.getByRole('button', { name: 'Demander un modèle à l’IA' }))
}

it('réserve le formulaire aux comptes connectés', () => {
  render(<CanvasWorkspace canvas={canvas} user={null} />)
  expect(screen.queryByRole('button', { name: 'Demander un modèle à l’IA' })).toBeNull()
  expect(request).not.toHaveBeenCalled()
})

it('vérifie le quota, choisit OpenAI, puis déplace et valide un aperçu sans écrire de pixel', async () => {
  request.mockResolvedValueOnce(access(4)).mockResolvedValueOnce(Response.json({ model, quota: quota(3) }))
  openForm()
  expect(submitButton().disabled).toBe(true)
  await screen.findByText('Modèles disponibles aujourd’hui : 4 sur 5.')
  const providers = screen.getByRole('combobox', { name: 'Vérification de la consigne' })
  expect(providers.value).toBe('jev')
  fireEvent.change(providers, { target: { value: 'openai' } })
  fireEvent.change(prompt(), { target: { value: '  Un éclair  ' } })
  fireEvent.click(submitButton())
  await screen.findByText('Modèle en aperçu en (-1, -1).')
  expect(screen.getByText('Modèles disponibles aujourd’hui : 3 sur 5.')).toBeTruthy()
  expect(request.mock.calls[0][0]).toBe('/api/models/quota')
  expect(request.mock.calls[1][0]).toBe('/api/models')
  expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({ prompt: 'Un éclair', moderationProvider: 'openai' })
  expect(drawing.globalAlpha).toBe(0.55)
  expect(drawing.fillRect.mock.calls).toEqual([[1, 1, 1, 1], [2, 2, 1, 1]])
  expect(screen.getByRole('button', { name: 'Poser le pixel' }).disabled).toBe(true)

  fireEvent.click(screen.getByRole('button', { name: 'Déplacer le modèle vers la gauche' }))
  expect(screen.getByText('Modèle en aperçu en (-2, -1).')).toBeTruthy()
  const board = screen.getByRole('img')
  Object.defineProperties(board, { clientWidth: { value: 50 }, clientHeight: { value: 50 } })
  drawing.fillRect.mockClear()
  fireEvent.click(board, { clientX: 49, clientY: 49 })
  expect(screen.getByText('Modèle en aperçu en (1, 1).')).toBeTruthy()
  expect(drawing.fillRect.mock.calls).toEqual([[3, 3, 1, 1], [4, 4, 1, 1]])

  fireEvent.click(screen.getByRole('button', { name: 'Valider le placement' }))
  expect(screen.getByText('Modèle placé en (1, 1).')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Poser le pixel' }).disabled).toBe(false)
  expect(request).toHaveBeenCalledTimes(2)
})

it('bloque l’envoi et affiche le seul fournisseur si le quota est épuisé', async () => {
  request.mockResolvedValueOnce(access(0, ['jev']))
  openForm()
  expect(await screen.findByText('Le quota de modèles est épuisé pour aujourd’hui.')).toBeTruthy()
  expect(screen.getByText('Consigne vérifiée par Jev.')).toBeTruthy()
  fireEvent.change(prompt(), { target: { value: 'Un éclair' } })
  fireEvent.click(submitButton())
  expect(submitButton().disabled).toBe(true)
  expect(request).toHaveBeenCalledOnce()
})

it('annonce un refus de Jev et conserve le quota affiché', async () => {
  request.mockResolvedValueOnce(access(2)).mockResolvedValueOnce(
    Response.json({ error: { code: 'PROMPT_REJECTED', message: 'Texte du fournisseur' } }, { status: 422 }),
  )
  openForm()
  await screen.findByText('Modèles disponibles aujourd’hui : 2 sur 5.')
  fireEvent.change(prompt(), { target: { value: 'Consigne refusée' } })
  fireEvent.click(submitButton())
  expect((await screen.findByRole('alert')).textContent).toBe('La consigne a été refusée. Votre quota reste intact.')
  expect(screen.getByText('Modèles disponibles aujourd’hui : 2 sur 5.')).toBeTruthy()
  expect(request).toHaveBeenCalledTimes(2)
})

it.each([
  ['une coupure réseau', () => Promise.reject(new Error('Connexion interrompue'))],
  ['un quota épuisé sur le serveur', () => Promise.resolve(Response.json({
    error: { code: 'MODEL_QUOTA_EXHAUSTED' },
  }, { status: 429 }))],
  ['un modèle invalide', () => Promise.resolve(Response.json({
    model: { ...model, pixels: [model.pixels[0], model.pixels[0]] }, quota: quota(0),
  }))],
])('relit le quota après %s avant d’autoriser un nouvel envoi', async (_, failure) => {
  const { promise, resolve } = Promise.withResolvers()
  request.mockResolvedValueOnce(access(1)).mockImplementationOnce(failure).mockReturnValueOnce(promise)
  openForm()
  await screen.findByText('Modèles disponibles aujourd’hui : 1 sur 5.')
  fireEvent.change(prompt(), { target: { value: 'Un éclair' } })
  fireEvent.click(submitButton())
  await screen.findByText('Lecture du quota…')
  expect(submitButton().disabled).toBe(true)
  await act(async () => resolve(access(0)))
  expect(screen.getByText('Le quota de modèles est épuisé pour aujourd’hui.')).toBeTruthy()
  expect(submitButton().disabled).toBe(true)
  expect(screen.queryByRole('group', { name: 'Placement du modèle' })).toBeNull()
  expect(request.mock.calls.map(([url]) => url)).toEqual(['/api/models/quota', '/api/models', '/api/models/quota'])
})
