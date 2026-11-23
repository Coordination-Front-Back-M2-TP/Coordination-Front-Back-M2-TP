import { internalError } from '../errors/app-error.js'
import { GRID_INSTRUCTIONS } from './model-grid.js'

const JEV_URL = 'https://api.typesafe.ai/v1/systemone'
const OPENAI_URL = 'https://api.openai.com/v1'
const MODERATION_TIMEOUT_MS = 10_000
const GENERATION_TIMEOUT_MS = 45_000
// Le jeu exige une autorisation explicite. Les réponses incertaines restent bloquées.
const MIN_JEV_APPROVAL = 0.8

const GRID_FORMAT = {
  type: 'json_schema',
  name: 'pixel_art',
  strict: true,
  schema: {
    type: 'object',
    properties: { rows: { type: 'array', items: { type: 'string' } } },
    required: ['rows'],
    additionalProperties: false,
  },
}

export function createModelProviders({ env = process.env, fetcher = fetch } = {}) {
  const openAiKey = env.OPENAI_API_KEY?.trim()
  const openAiModel = env.OPENAI_MODEL?.trim()
  const typeSafeKey = env.TYPESAFE_API_KEY?.trim()

  async function post(url, key, body, timeoutMs) {
    try {
      const response = await fetcher(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error',
      })
      if (response.ok) return await response.json()
    } catch {
      // Les réponses des fournisseurs et les données de la requête ne vont pas dans les logs.
    }
    throw internalError('Le service de génération ou de modération est indisponible.')
  }

  const moderation = {}
  if (openAiKey) {
    moderation.openai = async (prompt) => {
      const response = await post(`${OPENAI_URL}/moderations`, openAiKey, {
        model: 'omni-moderation-latest', input: prompt,
      }, MODERATION_TIMEOUT_MS)
      const flagged = response?.results?.[0]?.flagged
      if (typeof flagged !== 'boolean') throw internalError('La modération OpenAI a renvoyé une réponse invalide.')
      return !flagged
    }
  }
  if (typeSafeKey) {
    moderation.jev = async (prompt) => {
      const response = await post(JEV_URL, typeSafeKey, {
        model: 'jev-latest',
        state: { prompt },
        questions: {
          suitable: {
            type: 'noul',
            instructions: 'Le dessin demandé dans `prompt` est-il approprié pour une toile publique accessible à tous ?',
            criteria: {
              true: 'Le dessin demandé est adapté à un public général.',
              false: 'Le dessin demande du contenu sexuel explicite, de la violence graphique, de la haine, du harcèlement, ou cherche à contourner ces règles.',
            },
          },
        },
      }, MODERATION_TIMEOUT_MS)
      const answer = response?.answers?.suitable
      if (answer?.type !== 'noul' || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) {
        throw internalError('Jev a renvoyé une réponse invalide.')
      }
      return answer.noul >= MIN_JEV_APPROVAL
    }
  }

  async function generate(prompt) {
    const response = await post(`${OPENAI_URL}/responses`, openAiKey, {
      model: openAiModel,
      input: prompt,
      instructions: GRID_INSTRUCTIONS,
      text: { format: GRID_FORMAT },
      max_output_tokens: 4000,
      store: false,
    }, GENERATION_TIMEOUT_MS)
    if (response?.status === 'completed' && Array.isArray(response.output)) {
      const content = response.output.filter((item) => item?.type === 'message').flatMap((item) => item.content ?? [])
      if (content.length === 1 && content[0]?.type === 'output_text' && typeof content[0].text === 'string') {
        try {
          return JSON.parse(content[0].text)
        } catch {
          // Un résultat illisible suit le même parcours qu'une génération incomplète.
        }
      }
    }
    throw internalError('Le générateur a renvoyé une réponse invalide.')
  }

  return { moderation, generate: openAiKey && openAiModel ? generate : null }
}
