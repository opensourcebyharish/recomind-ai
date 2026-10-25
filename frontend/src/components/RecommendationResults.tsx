import { motion } from 'framer-motion'
import { ArrowRight, Heart, Star } from 'lucide-react'
import type { RecommendationItem } from '../types'

type Props = { items: RecommendationItem[]; favoriteIds: string[]; onDetails: (movie: RecommendationItem) => void; onFavorite: (id: string) => void; loading: boolean; message: string; error: boolean; onRefresh: () => void }

export function RecommendationResults({ items, favoriteIds, onDetails, onFavorite, loading, message, error, onRefresh }: Props) {
  return <section id="personalized-results" className="personalized-results" aria-labelledby="personalized-title">
    <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> FROM YOUR FEEDBACK</div><h2 id="personalized-title">Your next <em>watch.</em></h2><p>Recommendations returned by the RecoMind content engine.</p></div><button className="button button-outline" type="button" disabled={loading} onClick={onRefresh}>Refresh<ArrowRight size={15}/></button></div>
    {loading && <p className="recommendation-status" role="status">Following the threads in your tasteâ€¦</p>}
    {message && <p className={`recommendation-status ${error ? 'feedback-error' : ''}`} role={error ? 'alert' : 'status'}>{message}</p>}
    {!loading && items.length > 0 && <div className="recommendation-grid">{items.map((item, index) => <motion.article className={`recommendation-card poster-${['blue', 'rose', 'amber', 'violet'][index % 4]}`} key={item.movie_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .04 }}>
      <div className="recommendation-art"><span className="recommendation-art-glow"/><span className="recommendation-index">{String(index + 1).padStart(2, '0')}</span><span className="recommendation-title-art">{item.title}</span><span className="recommendation-genres">{item.genres.split('|').join(' Â· ')}</span></div>
      <div className="recommendation-copy"><div className="recommendation-meta">{item.release_year ?? 'Year unavailable'}{item.vote_average !== null && <span><Star size={12} fill="currentColor"/> {item.vote_average.toFixed(1)} catalog</span>}</div><p>{item.explanation}</p>{item.similarity_score !== null && <span className="recommendation-similarity">CONTENT SIMILARITY Â· {Math.round(item.similarity_score * 100)}%</span>}<div className="recommendation-actions"><button className="button button-outline" type="button" onClick={() => onDetails(item)}>Details<ArrowRight size={14}/></button><button type="button" className={`icon-button ${favoriteIds.includes(item.movie_id) ? 'favorite-active' : ''}`} aria-label={favoriteIds.includes(item.movie_id) ? `Remove ${item.title} from favorites` : `Save ${item.title} to favorites`} aria-pressed={favoriteIds.includes(item.movie_id)} onClick={() => onFavorite(item.movie_id)}><Heart size={17} fill={favoriteIds.includes(item.movie_id) ? 'currentColor' : 'none'}/></button></div></div>
    </motion.article>)}</div>}
  </section>
}
