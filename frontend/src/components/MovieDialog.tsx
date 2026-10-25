import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Star, X } from 'lucide-react'
import type { FeedbackResponse, Movie, MovieFeedbackType, RatingResponse, RecommendationItem } from '../types'
import { FeedbackPanel } from './FeedbackPanel'
import type { WatchStatus } from './DiscoveryPages'
import { MovieMedia } from './MovieMedia'

type DialogMovie = Movie | RecommendationItem
type Props = { movie: DialogMovie | null; favorite: boolean; onClose: () => void; onFavorite: (id: string) => void; watchStatus: WatchStatus | null; onWatchlist: (id: string, status: WatchStatus | null) => void; ratingCompatible: boolean; feedbackCompatible: boolean; theme: string; rating: RatingResponse | null; feedback: FeedbackResponse | null; feedbackBusy: boolean; feedbackMessage: string; feedbackError: boolean; onRate: (value: number) => void; onFeedback: (type: MovieFeedbackType) => void; canRefresh: boolean; refreshBusy: boolean; refreshMessage: string; refreshError: boolean; onRefresh: () => void }

export const isDialogEscapeKey = (key: string) => key === 'Escape'
export const isDialogBackdropTarget = (target: EventTarget | null, currentTarget: EventTarget | null) => target === currentTarget

export function lockDialogPageScroll(body: Pick<HTMLElement, 'style'>, root: Pick<HTMLElement, 'style'>) {
  const previousBodyOverflow = body.style.overflow
  const previousRootOverflow = root.style.overflow
  body.style.overflow = 'hidden'
  root.style.overflow = 'hidden'
  return () => {
    body.style.overflow = previousBodyOverflow
    root.style.overflow = previousRootOverflow
  }
}

function isRecommendationItem(m: DialogMovie): m is RecommendationItem {
  return 'explanation' in m
}

export function MovieDialog(props: Props) {
  const { movie, favorite, onClose, onFavorite, watchStatus, onWatchlist, ratingCompatible, feedbackCompatible, theme, rating, feedback, feedbackBusy, feedbackMessage, feedbackError, onRate, onFeedback, canRefresh, refreshBusy, refreshMessage, refreshError, onRefresh } = props
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const trailerOpenRef = useRef(false)
  const [trailerOpen, setTrailerOpenState] = useState(false)
  const setTrailerOpen = useCallback((open: boolean) => { trailerOpenRef.current = open; setTrailerOpenState(open) }, [])
  onCloseRef.current = onClose
  useEffect(() => {
    if (!movie) { previousFocus.current?.focus(); previousFocus.current = null; return }
    if (!previousFocus.current && document.activeElement instanceof HTMLElement) previousFocus.current = document.activeElement
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (trailerOpenRef.current) return
      if (isDialogEscapeKey(event.key)) onCloseRef.current()
      if (event.key !== 'Tab') return
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
      const controls = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])')
      if (!controls?.length) return
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [movie?.movie_id])

  useEffect(() => {
    if (!movie) return
    return lockDialogPageScroll(document.body, document.documentElement)
  }, [movie?.movie_id])

  const getSourceLabel = () => {
    if (!movie) return ''
    if (isRecommendationItem(movie)) return 'RECOMMENDED FOR YOU'
    if (movie.source === 'tmdb') return 'TMDB CATALOG'
    if (movie.source === 'movielens') return 'MOVIELENS CATALOG'
    if (movie.source === 'hybrid') return 'HYBRID RECOMMENDATION'
    return 'DEMO CATALOG'
  }

  const getOverview = () => {
    if (!movie) return ''
    if (isRecommendationItem(movie)) return movie.explanation
    if ('overview' in movie) return movie.overview || ''
    return ''
  }

  const getNote = () => {
    if (!movie) return null
    if (isRecommendationItem(movie)) return null
    if (movie.source === 'tmdb') return <p className="demo-note">TMDB catalog entry.</p>
    if (movie.source === 'movielens' || movie.source === 'hybrid') return <p className="demo-note">Recommendation result from the {movie.source === 'movielens' ? 'MovieLens' : 'hybrid'} pipeline. Feedback is limited to local catalog IDs.</p>
    return <p className="demo-note">Illustrative sample catalog entry. This is not a live recommendation.</p>
  }

  const genres = movie?.genres ? movie.genres.split('|').join(' Â· ') : ''
  const backdrop = (movie as Movie)?.backdrop_url || (movie as Movie)?.poster_url

  return <AnimatePresence>
    {movie && <motion.div className="dialog-backdrop" role="presentation" onClick={(event) => { if (isDialogBackdropTarget(event.target, event.currentTarget)) onClose() }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section className={`movie-dialog ${!isRecommendationItem(movie) && movie.source === 'tmdb' ? 'movie-dialog-with-media' : ''}`} role="dialog" aria-modal={!trailerOpen} aria-labelledby="dialog-title" initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}>
        <div className="dialog-sticky-header"><button ref={closeRef} className="icon-button dialog-close" aria-label="Close movie details" onClick={onClose}><X size={18}/></button></div>
        <div className={`dialog-art poster-${theme}`} style={backdrop && !isRecommendationItem(movie) ? { backgroundImage: `url(${backdrop})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}} aria-hidden="true">
          <div className="poster-orbit"/>
          {!backdrop && <><span className="poster-title-art">{movie.title}</span><span className="poster-year-art">A FILM Â· {movie.release_year ?? 'â€”'}</span></>}
        </div>
        <div className="dialog-content">
          <div className="eyebrow"><span className="eyebrow-line"/> {getSourceLabel()}</div><h2 id="dialog-title">{movie.title}</h2>
          <div className="dialog-facts">
            {movie.release_year !== null && movie.release_year !== undefined && <span>{movie.release_year}</span>}
            {genres && <><span>Â·</span><span>{genres}</span></>}
            {movie.vote_average !== null && movie.vote_average !== undefined && <span className="rating"><Star size={13} fill="currentColor"/>{movie.vote_average.toFixed(1)} <small>{!isRecommendationItem(movie) && movie.source === 'tmdb' ? 'TMDB rating' : 'catalog rating'}</small></span>}
          </div>
          <p>{getOverview()}</p>
          {getNote()}
          <button className={`button ${favorite ? 'button-soft' : 'button-outline'}`} onClick={() => onFavorite(movie.movie_id)}><Heart size={16} fill={favorite ? 'currentColor' : 'none'}/>{favorite ? 'Saved to favorites' : 'Save to favorites'}</button>
          <div className="dialog-watchlist-actions" role="group" aria-label="Watchlist status">
            <button className={`button ${watchStatus === 'want' ? 'button-soft' : 'button-outline'}`} aria-pressed={watchStatus === 'want'} onClick={() => onWatchlist(movie.movie_id, watchStatus === 'want' ? null : 'want')}>{watchStatus === 'want' ? 'On watchlist' : 'Want to watch'}</button>
            <button className={`button ${watchStatus === 'watched' ? 'button-soft' : 'button-outline'}`} aria-pressed={watchStatus === 'watched'} onClick={() => onWatchlist(movie.movie_id, watchStatus === 'watched' ? null : 'watched')}>{watchStatus === 'watched' ? 'Watched' : 'Mark watched'}</button>
          </div>
          {!isRecommendationItem(movie) && movie.source === 'tmdb' && typeof movie.tmdb_id === 'number' && movie.tmdb_id > 0 && <MovieMedia key={movie.tmdb_id} tmdbMovieId={movie.tmdb_id} onTrailerOpenChange={setTrailerOpen}/>}
          {ratingCompatible ? <FeedbackPanel movieId={movie.movie_id} canReact={feedbackCompatible} showRefresh={feedbackCompatible} rating={rating} feedback={feedback} busy={feedbackBusy} message={feedbackMessage} error={feedbackError} onRate={onRate} onFeedback={onFeedback} canRefresh={canRefresh} refreshBusy={refreshBusy} refreshMessage={refreshMessage} refreshError={refreshError} onRefresh={onRefresh}/> : <p className="demo-note">Ratings and reactions are available for local and TMDB catalog titles. Other catalog IDs remain separate.</p>}
        </div>
      </motion.section>
    </motion.div>}
  </AnimatePresence>
}
