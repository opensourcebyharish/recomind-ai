import { motion } from 'framer-motion'
import { Heart, Info, Star } from 'lucide-react'
import type { Movie } from '../types'

type Props = {
  movie: Movie
  index?: number
  favorite: boolean
  selected: boolean
  onFavorite: (id: string) => void
  onSelect: (movie: Movie) => void
  onDetails: (movie: Movie) => void
  theme: string
  tasteSelectionEnabled?: boolean
}

export function MovieCard({ movie, index = 0, favorite, selected, onFavorite, onSelect, onDetails, theme, tasteSelectionEnabled = true }: Props) {
  const genre = movie.genres?.split('|')[0] || 'Movie'
  const sourceLabel = movie.source === 'tmdb' ? 'TMDB' : movie.source === 'movielens' ? 'MOVIELENS' : movie.source === 'hybrid' ? 'HYBRID' : 'DEMO'
  const rating = movie.vote_average !== null && movie.vote_average !== undefined ? movie.vote_average.toFixed(1) : 'â€”'
  const year = movie.release_year ?? 'â€”'

  return (
    <motion.article className={`movie-card ${selected ? 'is-selected' : ''}`} layout whileHover={{ y: -3 }} whileTap={{ scale: 0.99 }}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.045, 0.36), duration: 0.36 }}>
      <div className={`poster poster-${theme}`} style={movie.poster_url ? { backgroundImage: `url(${movie.poster_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
        <div className="poster-orbit" aria-hidden="true" />
        <span className="poster-kicker" aria-hidden="true">RECOMIND Â· {sourceLabel}</span>
        {!movie.poster_url && <><span className="poster-title-art" aria-hidden="true">{movie.title}</span><span className="poster-year-art" aria-hidden="true">A FILM Â· {year}</span></>}
        <div className="poster-fade" aria-hidden="true" />
        <motion.button whileTap={{ scale: 0.84 }} className={`icon-button favorite-button ${favorite ? 'is-favorite' : ''}`} aria-label={favorite ? `Remove ${movie.title} from favorites` : `Add ${movie.title} to favorites`} aria-pressed={favorite} onClick={() => onFavorite(movie.movie_id)}>
          <Heart size={16} fill={favorite ? 'currentColor' : 'none'} />
        </motion.button>
        {tasteSelectionEnabled && <motion.button whileTap={{ scale: 0.96 }} className="poster-select" aria-label={selected ? `Remove ${movie.title} from your taste selections` : `Add ${movie.title} to your taste selections`} aria-pressed={selected} onClick={() => onSelect(movie)}>
          <span className={`selection-dot ${selected ? 'checked' : ''}`}>{selected ? 'âœ“' : '+'}</span>{selected ? 'In your taste' : 'Add to your taste'}
        </motion.button>}
      </div>
      <div className="movie-meta">
        <div className="movie-heading"><h3>{movie.title}</h3><span className="movie-year">{year}</span></div>
        <div className="movie-subline"><span>{genre}</span><span className="meta-separator">Â·</span><span className="rating" role="img" aria-label={`Rating ${rating} out of 10`}><Star size={12} fill="currentColor" />{rating}</span><button className="details-link" onClick={() => onDetails(movie)} aria-label={`Details for ${movie.title}`}><Info size={14} /></button></div>
      </div>
    </motion.article>
  )
}
