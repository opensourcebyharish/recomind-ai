import type { FeedbackRequest, FeedbackResponse, RatingRequest, RatingResponse, RecommendationRequest, RecommendationResponse, RecordRecommendationInteractionRequest, RecordRecommendationInteractionResponse, UserFeedbackHistoryResponse } from '../types'
import type { TMDBCatalogResponse, TMDBCountry, TMDBStatus, TMDBVideosResponse, TMDBWatchProvidersResponse } from '../types/tmdb'

export class ApiRequestError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
  if (!response.ok) throw await responseError(response, 'Request failed')
  return response.json() as Promise<T>
}

async function responseError(response: Response, fallback: string): Promise<ApiRequestError> {
  let detail = `${fallback} (${response.status})`
  try {
    const data = await response.json()
    if (typeof data?.detail === 'string') detail = data.detail
    else if (Array.isArray(data?.detail)) detail = data.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join('; ') || detail
  } catch { /* use status message */ }
  return new ApiRequestError(detail, response.status)
}

export function submitMovieRating(request: RatingRequest): Promise<RatingResponse> {
  return postJson('/api/feedback/rating', request)
}

export function submitMovieFeedback(request: FeedbackRequest): Promise<FeedbackResponse> {
  return postJson(`/api/feedback/${request.feedback_type}`, request)
}

export function recordRecommendationInteraction(request: RecordRecommendationInteractionRequest): Promise<RecordRecommendationInteractionResponse> {
  return postJson('/api/feedback/interaction', request)
}

export async function getFeedbackHistory(userId: string, signal?: AbortSignal): Promise<UserFeedbackHistoryResponse> {
  const response = await fetch(`${apiBaseUrl}/api/feedback/history/${encodeURIComponent(userId)}`, { signal })
  if (!response.ok) throw await responseError(response, 'Feedback history request failed')
  return response.json() as Promise<UserFeedbackHistoryResponse>
}

export type HealthResponse = {
  status: 'ok'
  app: string
  version: string
  environment: string
  database: 'ok'
}

export type PersonalizedRecommendationItem = {
  movie_id: string
  title: string
  genres: string
  release_year: number | null
  vote_average: number | null
  score: number
  explanation: string
  source: 'content' | 'collaborative' | 'hybrid'
}

export type PersonalizedRecommendationResponse = {
  user_id: string
  catalog: 'local'
  count: number
  recommendations: PersonalizedRecommendationItem[]
  strategy: string
}

const apiBaseUrl = (import.meta.env?.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

/** Calls the existing API health route. */
export async function getApiHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl}/health`, { signal })
  if (!response.ok) throw new Error(`API health check failed (${response.status})`)
  return response.json() as Promise<HealthResponse>
}

/** Fetch content-based recommendations from the FastAPI backend. */
export async function getRecommendations(
  request: RecommendationRequest,
  signal?: AbortSignal,
): Promise<RecommendationResponse> {
  const response = await fetch(`${apiBaseUrl}/api/recommendations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })

  if (!response.ok) {
    let detail = `Recommendation request failed (${response.status})`
    try {
      const data = await response.json()
      if (typeof data?.detail === 'string') {
        detail = data.detail
      }
    } catch {
      // Ignore JSON parse errors and use the status-based message
    }
    throw new ApiRequestError(detail, response.status)
  }

  return response.json() as Promise<RecommendationResponse>
}

/** Get local-catalog content recommendations from saved feedback. */
export async function getPersonalizedRecommendations(
  userId: string,
  topN: number = 10,
  signal?: AbortSignal,
): Promise<PersonalizedRecommendationResponse> {
  const response = await fetch(`${apiBaseUrl}/api/recommendations/personalized?user_id=${encodeURIComponent(userId)}&top_n=${topN}`, { signal })
  if (!response.ok) throw await responseError(response, 'Personalized recommendations request failed')
  return response.json() as Promise<PersonalizedRecommendationResponse>
}

/** Get TMDB configuration status. */
export async function getTMDBStatus(signal?: AbortSignal): Promise<TMDBStatus> {
  const response = await fetch(`${apiBaseUrl}/api/tmdb/status`, { signal })
  if (!response.ok) throw await responseError(response, 'TMDB status request failed')
  return response.json() as Promise<TMDBStatus>
}

/** Get popular movies from TMDB. */
export async function getTMDBPopular(page: number = 1, signal?: AbortSignal): Promise<TMDBCatalogResponse> {
  const response = await fetch(`${apiBaseUrl}/api/tmdb/popular?page=${page}`, { signal })
  if (!response.ok) throw await responseError(response, 'TMDB popular movies request failed')
  return response.json() as Promise<TMDBCatalogResponse>
}

/** Search movies on TMDB. */
export async function searchTMDBMovies(query: string, page: number = 1, signal?: AbortSignal): Promise<TMDBCatalogResponse> {
  const response = await fetch(`${apiBaseUrl}/api/tmdb/search?q=${encodeURIComponent(query)}&page=${page}`, { signal })
  if (!response.ok) throw await responseError(response, 'TMDB search request failed')
  return response.json() as Promise<TMDBCatalogResponse>
}

/** Fetch trailer/video metadata for an explicitly identified TMDB movie. */
export async function getTMDBMovieVideos(tmdbMovieId: number, signal?: AbortSignal): Promise<TMDBVideosResponse> {
  const response = await fetch(`${apiBaseUrl}/api/tmdb/movies/${tmdbMovieId}/videos`, { signal })
  if (!response.ok) throw await responseError(response, 'Movie videos request failed')
  return response.json() as Promise<TMDBVideosResponse>
}

/** Fetch legal streaming availability for a TMDB movie in a two-letter region. */
export async function getTMDBWatchProviders(tmdbMovieId: number, region = 'IN', signal?: AbortSignal): Promise<TMDBWatchProvidersResponse> {
  const response = await fetch(`${apiBaseUrl}/api/tmdb/movies/${tmdbMovieId}/watch-providers?region=${encodeURIComponent(region)}`, { signal })
  if (!response.ok) throw await responseError(response, 'Watch availability request failed')
  return response.json() as Promise<TMDBWatchProvidersResponse>
}

/** Fetch the country list TMDB supports for regional provider availability. */
export async function getTMDBCountries(signal?: AbortSignal): Promise<TMDBCountry[]> {
  const response = await fetch(`${apiBaseUrl}/api/tmdb/countries`, { signal })
  if (!response.ok) throw await responseError(response, 'Supported regions request failed')
  return response.json() as Promise<TMDBCountry[]>
}
