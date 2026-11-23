// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { getDrawingAgent, readPlacedModel, startDrawingAgent } from '../api/drawing-agent.js'
import { useDrawingAgent } from './use-drawing-agent.js'

vi.mock('../api/drawing-agent.js', () => ({
  getDrawingAgent: vi.fn(),
  readPlacedModel: vi.fn(),
  startDrawingAgent: vi.fn(),
  stopDrawingAgent: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.resetAllMocks()
})

it('ignore une lecture qui arrive après le lancement de l’agent', async () => {
  vi.useFakeTimers()
  let finishOldRead
  let oldSignal
  const started = { total: 2, done: 0 }
  vi.mocked(getDrawingAgent)
    .mockResolvedValueOnce(null)
    .mockImplementationOnce((signal) => new Promise((resolve) => {
      oldSignal = signal
      finishOldRead = resolve
    }))
    .mockResolvedValueOnce(started)
  vi.mocked(readPlacedModel).mockResolvedValue([{ x: 1, y: 1, color: '#D93A3A' }])
  vi.mocked(startDrawingAgent).mockResolvedValue(started)
  const { result } = renderHook(() => useDrawingAgent(true))
  await act(async () => {})
  expect(result.current.loaded).toBe(true)
  await act(() => vi.advanceTimersByTimeAsync(2000))

  await act(() => result.current.start({}))
  expect(oldSignal.aborted).toBe(true)
  await act(async () => finishOldRead(null))
  expect(result.current.agent).toEqual(started)
})
