import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw, Star, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { FeedbackResponse, MovieFeedbackType, RatingResponse } from '../types'

type Props = {
  movieId: string
  canReact: boolean
  showRefresh: boolean
  rating: RatingResponse | null
  feedback: FeedbackResponse | null
  busy: boolean
  message: string
  error: boolean
  onRate: (value: number) => void
  onFeedback: (type: MovieFeedbackType) => void
  canRefresh: boolean
  refreshBusy: boolean
  refreshMessage: string
  refreshError: boolean
  onRefresh: () => void
}

export function FeedbackPanel({ movieId, canReact, showRefresh, rating, feedback, busy, message, error, onRate, onFeedback, canRefresh, refreshBusy, refreshMessage, refreshError, onRefresh }: Props) {
  const [hovered, setHovered] = useState(0)
  return <section className="feedback-panel" aria-labelledby={`feedback-title-${movieId}`}>
    <div className="feedback-heading"><span className="eyebrow"><span className="eyebrow-line"/> HELP YOUR TASTE TAKE SHAPE</span><h3 id={`feedback-title-${movieId}`}>What did you think?</h3><p>Your rating and reaction can be updated any time.</p></div>
    <div className="feedback-rating" role="group" aria-label="Rate this movie from 1 to 5 stars">
      {[1, 2, 3, 4, 5].map((value) => <button key={value} className={`feedback-star ${(hovered || rating?.rating || 0) >= value ? 'feedback-star-active' : ''}`} type="button" aria-label={`Rate ${value} out of 5`} aria-pressed={rating?.rating === value} disabled={busy} onMouseEnter={() => setHovered(value)} onMouseLeave={() => setHovered(0)} onFocus={() => setHovered(value)} onBlur={() => setHovered(0)} onClick={() => onRate(value)}><Star size={20} fill={(hovered || rating?.rating || 0) >= value ? 'currentColor' : 'none'}/></button>)}
      {rating && <span className="feedback-rating-value">{rating.rating}/5</span>}
      {busy && <span className="feedback-pending" role="status">Savingâ€¦</span>}
    </div>
    {canReact && <div className="feedback-actions" role="group" aria-label="Like or dislike this movie">
      <button type="button" className={`button feedback-choice ${feedback?.feedback_type === 'like' ? 'feedback-selected' : 'button-outline'}`} aria-pressed={feedback?.feedback_type === 'like'} disabled={busy} onClick={() => onFeedback('like')}><ThumbsUp size={16}/>Like</button>
      <button type="button" className={`button feedback-choice ${feedback?.feedback_type === 'dislike' ? 'feedback-selected feedback-selected-negative' : 'button-outline'}`} aria-pressed={feedback?.feedback_type === 'dislike'} disabled={busy} onClick={() => onFeedback('dislike')}><ThumbsDown size={16}/>Dislike</button>
    </div>}
    {!canReact && <p className="feedback-hint">TMDB ratings are saved to Activity; local recommendation feedback stays in the local catalog.</p>}
    <AnimatePresence mode="wait">{message && <motion.p key={message} className={`feedback-message ${error ? 'feedback-error' : 'feedback-success'}`} role={error ? 'alert' : 'status'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{message}</motion.p>}</AnimatePresence>
    <div className="feedback-disclaimer">Feedback is stored under an unauthenticated browser demo ID. It is not a secure account.</div>
    {showRefresh && (rating || feedback) && <div className="feedback-refresh">
      <button className="button button-primary" type="button" disabled={refreshBusy} onClick={onRefresh}><RefreshCw size={15} className={refreshBusy ? 'feedback-spinning' : ''}/>{refreshBusy ? 'Finding your next filmsâ€¦' : 'Refresh recommendations'}<span aria-hidden="true">â†’</span></button>
      {!canRefresh && <p className="feedback-hint">Like a film or rate one 4â€“5 stars to create a positive recommendation signal.</p>}
      {refreshMessage && <p className={`feedback-message ${refreshError ? 'feedback-error' : 'feedback-success'}`} role={refreshError ? 'alert' : 'status'}>{refreshMessage}</p>}
    </div>}
  </section>
}
