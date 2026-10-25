export type MovieSource = 'local' | 'tmdb' | 'movielens' | 'hybrid'

export type Movie = {
  movie_id: string
  title: string
  genres: string
  overview: string | null
  release_year: number | null
  vote_average: number | null
  poster_url?: string | null
  backdrop_url?: string | null
  source?: MovieSource
  tmdb_id?: number | null
  recommendation_source?: 'content' | 'collaborative' | 'hybrid'
}

export type RecommendationItem = {
  movie_id: string
  title: string
  genres: string
  release_year: number | null
  vote_average: number | null
  similarity_score: number | null
  score: number | null
  explanation: string
}

export type RecommendationMode = 'similar' | 'liked'
export type RecommendationAlgorithm = 'content' | 'collaborative'

export type RecommendationRequest = {
  mode?: RecommendationMode
  algorithm?: RecommendationAlgorithm
  movie_id?: string
  liked_movie_ids?: string[]
  user_id?: number | null
  top_n?: number
  genre_preference?: string | string[]
  min_vote_average?: number | null
  exclude_ids?: string[]
  exclude_rated_by_user?: string[]
}

export type RecommendationResponse = {
  mode: RecommendationMode
  algorithm: RecommendationAlgorithm
  source_movie_id: string | null
  liked_movie_ids: string[] | null
  user_id: number | null
  catalog: 'local' | 'movielens'
  count: number
  recommendations: RecommendationItem[]
  dataset: string
}

export type MovieFeedbackType = 'like' | 'dislike'
export type RatingCatalog = 'local' | 'tmdb'

export type RatingRequest = {
  user_id: string
  catalog: RatingCatalog
  movie_id: string
  rating: number
}

export type FeedbackRequest = {
  user_id: string
  movie_id: string
  feedback_type: MovieFeedbackType
}

export type RatingResponse = {
  id: number
  user_id: string
  catalog: RatingCatalog
  movie_id: string
  rating: number
  created_at: string
  updated_at: string
}

/** Mirrors the backend's FeedbackResponse schema. */
export type FeedbackResponse = {
  id: number
  user_id: string
  movie_id: string
  feedback_type: string
  created_at: string
  updated_at: string
}

export type RecommendationInteractionResponse = {
  id: number
  movie_id: string
  interaction_type: 'click' | 'view'
  created_at: string
}

export type RecordRecommendationInteractionRequest = {
  user_id: string
  movie_id: string
  interaction_type: 'click' | 'view'
}

export type RecordRecommendationInteractionResponse = RecommendationInteractionResponse & {
  status: 'ok'
}

export type UserFeedbackHistoryResponse = {
  user_id: string
  ratings: RatingResponse[]
  feedback: FeedbackResponse[]
  interactions: RecommendationInteractionResponse[]
}
