import type { FeedbackResponse, RatingResponse, RecommendationRequest } from '../types'

type Preferences = {
  feedback: Record<string, FeedbackResponse>
  ratings: Record<string, RatingResponse>
  tasteGenres: string[]
  minimumRating: number
  excludeFavorites: boolean
  favorites: string[]
  localMovieIds: string[]
}

export function buildFeedbackRecommendationRequest({ feedback, ratings, tasteGenres, minimumRating, excludeFavorites, favorites, localMovieIds }: Preferences): RecommendationRequest | null {
  const localIds = new Set(localMovieIds)
  const positive = new Set(Object.values(feedback).filter((item) => localIds.has(item.movie_id) && item.feedback_type === 'like').map((item) => item.movie_id))
  Object.values(ratings).filter((item) => localIds.has(item.movie_id) && item.rating >= 4).forEach((item) => positive.add(item.movie_id))
  if (!positive.size) return null

  const negative = new Set(Object.values(feedback).filter((item) => localIds.has(item.movie_id) && item.feedback_type === 'dislike').map((item) => item.movie_id))
  Object.values(ratings).filter((item) => localIds.has(item.movie_id) && item.rating <= 2).forEach((item) => negative.add(item.movie_id))
  negative.forEach((movieId) => positive.delete(movieId))
  if (!positive.size) return null
  return {
    mode: 'liked',
    algorithm: 'content',
    liked_movie_ids: [...positive],
    top_n: 12,
    genre_preference: tasteGenres.length ? tasteGenres : undefined,
    min_vote_average: minimumRating || undefined,
    exclude_ids: [...new Set([...negative, ...(excludeFavorites ? favorites.filter((movieId) => localIds.has(movieId)) : [])])],
    exclude_rated_by_user: Object.values(ratings).filter((item) => localIds.has(item.movie_id)).map((item) => item.movie_id),
  }
}
