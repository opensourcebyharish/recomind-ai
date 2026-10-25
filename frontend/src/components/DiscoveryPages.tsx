import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowRight, Dice5, Heart, RotateCcw, Sparkles, Star } from 'lucide-react'
import { MovieCard } from './MovieCard'
import type { FeedbackResponse, Movie, RatingResponse, RecommendationInteractionResponse } from '../types'

export type WatchStatus = 'want' | 'watched'

type MovieActions = {
  movies: Movie[]
  favorites: string[]
  watchlist: Record<string, WatchStatus>
  onFavorite: (id: string) => void
  onWatchlist: (id: string, status: WatchStatus | null) => void
  onDetails: (movie: Movie) => void
  liked: string[]
  onSelect: (movie: Movie) => void
}

export function WatchlistPage({ movies, favorites, watchlist, onFavorite, onWatchlist, onDetails, liked, onSelect }: MovieActions) {
  const [filter, setFilter] = useState<'all' | WatchStatus | 'favorites'>('all')
  const saved = movies.filter((movie) => (filter === 'all' ? Boolean(watchlist[movie.movie_id] || favorites.includes(movie.movie_id)) : filter === 'favorites' ? favorites.includes(movie.movie_id) : watchlist[movie.movie_id] === filter))
  return <section className="catalog-section page-section" aria-labelledby="watchlist-title">
    <PageHeading eyebrow="YOUR PERSONAL SHELF" title={<>Saved <em>for later.</em></>} description="Favorites and watch status stay on this browser. No account is connected." />
    <div className="page-tabs" role="group" aria-label="Filter saved movies">{(['all', 'want', 'watched', 'favorites'] as const).map((item) => <button key={item} className={`genre-pill ${filter === item ? 'pill-active' : ''}`} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === 'all' ? 'All saved' : item === 'want' ? 'Want to watch' : item === 'watched' ? 'Watched' : 'Favorites'}</button>)}</div>
    {saved.length ? <div className="movie-grid">{saved.map((movie, index) => <div className="watchlist-item" key={movie.movie_id}><MovieCard movie={movie} index={index} favorite={favorites.includes(movie.movie_id)} selected={liked.includes(movie.movie_id)} onFavorite={onFavorite} onSelect={onSelect} onDetails={onDetails} theme="blue" tasteSelectionEnabled={movie.source === 'local'}/><div className="watchlist-status"><span>{watchlist[movie.movie_id] === 'watched' ? 'Watched' : watchlist[movie.movie_id] === 'want' ? 'Want to watch' : 'Favorite'}</span>{watchlist[movie.movie_id] && <button className="text-button" onClick={() => onWatchlist(movie.movie_id, null)}>Remove from watchlist</button>}</div></div>)}</div> : <EmptyPage title="Your shelf is waiting." text="Save a film with the heart, or add it to your watchlist from its details." />}
  </section>
}

export function TasteProfilePage({ ratings, feedback, favorites, localMovies }: { ratings: Record<string, RatingResponse>; feedback: Record<string, FeedbackResponse>; favorites: string[]; localMovies: Movie[] }) {
  const localRatings = Object.values(ratings).filter((item) => item.catalog === 'local')
  const distribution = [1, 2, 3, 4, 5].map((value) => localRatings.filter((item) => Math.round(item.rating) === value).length)
  const genres = new Map<string, number>()
  for (const id of new Set([...Object.keys(ratings), ...Object.keys(feedback)])) {
    const movie = localMovies.find((item) => item.movie_id === id)
    if (!movie) continue
    for (const genre of movie.genres.split('|')) genres.set(genre, (genres.get(genre) ?? 0) + 1)
  }
  const topGenres = [...genres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxGenre = Math.max(1, ...topGenres.map(([, count]) => count))
  return <section className="page-section profile-page" aria-labelledby="taste-profile-title">
    <PageHeading eyebrow="YOUR TASTE, IN FOCUS" title={<>A profile in <em>stories.</em></>} description="Insights are calculated from saved feedback and this sample catalog only." />
    <div className="profile-stat-grid"><ProfileStat label="Local ratings" value={localRatings.length}/><ProfileStat label="Likes" value={Object.values(feedback).filter((item) => item.feedback_type === 'like').length}/><ProfileStat label="Dislikes" value={Object.values(feedback).filter((item) => item.feedback_type === 'dislike').length}/><ProfileStat label="Favorites" value={favorites.length}/></div>
    <div className="profile-panels"><section className="profile-panel"><h3>Local rating distribution</h3>{localRatings.length ? <div className="distribution-chart" role="img" aria-label={`Local rating distribution: ${distribution.map((count, i) => `${i + 1} stars ${count}`).join(', ')}`}>{distribution.map((count, i) => <div className="distribution-row" key={i}><span>{i + 1}<Star size={12}/></span><div><i style={{ width: `${Math.max(count ? 6 : 0, count / Math.max(1, ...distribution) * 100)}%` }}/></div><b>{count}</b></div>)}</div> : <p className="profile-empty">Rate local catalog movies to see your rating pattern.</p>}</section>
      <section className="profile-panel"><h3>Genres you return to</h3>{topGenres.length ? <div className="genre-chart" role="img" aria-label={`Genres in your feedback: ${topGenres.map(([name, count]) => `${name} ${count}`).join(', ')}`}>{topGenres.map(([name, count]) => <div className="genre-chart-row" key={name}><span>{name}</span><div><i style={{ width: `${count / maxGenre * 100}%` }}/></div><b>{count}</b></div>)}</div> : <p className="profile-empty">Genre insights appear after you rate or react to local catalog films.</p>}</section></div>
  </section>
}

export function ActivityPage({ ratings, feedback, interactions, movies, interactionError }: { ratings: Record<string, RatingResponse>; feedback: Record<string, FeedbackResponse>; interactions: RecommendationInteractionResponse[]; movies: Movie[]; interactionError?: string }) {
  const activity = [
    ...Object.values(ratings).map((item) => ({ key: `rating-${item.id}`, id: item.movie_id, catalog: item.catalog, label: `Rated ${item.rating}/5`, at: item.updated_at })),
    ...Object.values(feedback).map((item) => ({ key: `feedback-${item.id}`, id: item.movie_id, label: item.feedback_type === 'like' ? 'Liked' : 'Disliked', at: item.updated_at })),
    ...interactions.map((item) => ({ key: `interaction-${item.id}`, id: item.movie_id, label: item.interaction_type === 'view' ? 'Recommendation impression' : 'Opened movie details', at: item.created_at })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  return <section className="page-section activity-page" aria-labelledby="activity-title"><PageHeading eyebrow="YOUR RECENT SIGNALS" title={<>The trail so <em>far.</em></>} description="Saved ratings, reactions, recommendation impressions, and movie-detail opens. Interaction events are activity history only and do not affect ranking."/>
    {interactionError && <p className="recommendation-status feedback-error" role="alert">{interactionError}</p>}
    {activity.length ? <ol className="activity-list">{activity.map((item) => <li key={item.key}><span className="activity-mark"/><div><b>{item.label}</b><span>{movies.find((movie) => movie.movie_id === item.id)?.title ?? ('catalog' in item && item.catalog === 'tmdb' ? `TMDB movie ${item.id.replace(/^tmdb:/, '')}` : `Movie ${item.id}`)}</span>{'catalog' in item && <small className="activity-catalog">{item.catalog === 'tmdb' ? 'TMDB catalog' : 'Local catalog'}</small>}</div><time dateTime={item.at}>{Number.isNaN(Date.parse(item.at)) ? 'Date unavailable' : new Date(item.at).toLocaleString()}</time></li>)}</ol> : <EmptyPage title="Nothing on the reel yet." text="Your saved ratings, reactions, and recommendation interactions will appear here."/>}
  </section>
}

export function MatchPage({ movies, onDetails, favorites, onFavorite, liked, onSelect }: { movies: Movie[]; onDetails: (movie: Movie) => void; favorites: string[]; onFavorite: (id: string) => void; liked: string[]; onSelect: (movie: Movie) => void }) {
  const [prompt, setPrompt] = useState('')
  const [genre, setGenre] = useState('')
  const [mood, setMood] = useState('')
  const matches = useMemo(() => {
    const terms = prompt.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []
    return movies.map((movie) => {
      const metadata = `${movie.title} ${movie.genres} ${movie.overview ?? ''}`.toLowerCase()
      const matched = [...new Set(terms.filter((term) => metadata.includes(term)))]
      const genreMatch = genre && movie.genres.toLowerCase().includes(genre.toLowerCase())
      const moodMatch = mood && metadata.includes(mood)
      const score = matched.length + (genreMatch ? 2 : 0) + (moodMatch ? 1 : 0)
      return { movie, score, reason: [...(genreMatch ? [genre] : []), ...(moodMatch ? [mood] : []), ...matched].slice(0, 5) }
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 12)
  }, [genre, mood, movies, prompt])
  return <section className="page-section match-page" aria-labelledby="match-title"><PageHeading eyebrow="METADATA-BASED DISCOVERY" title={<>Find a film by <em>feeling.</em></>} description="Matches titles, genres, and overviews. This is transparent metadata matching, not an LLM."/>
    <form className="match-form" onSubmit={(event) => event.preventDefault()}><label htmlFor="match-prompt">Describe what you want to watch</label><textarea id="match-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="A mind-bending science-fiction story with a surprising endingâ€¦" rows={3}/><div className="match-options"><label>Genre<select value={genre} onChange={(event) => setGenre(event.target.value)}><option value="">Any genre</option>{['Action','Adventure','Comedy','Drama','Mystery','Romance','Sci-Fi','Thriller','Western'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Mood<select value={mood} onChange={(event) => setMood(event.target.value)}><option value="">Any mood</option>{['mysterious','hopeful','dark','romantic','funny','philosophical','tense','surprising'].map((item) => <option key={item}>{item}</option>)}</select></label></div></form>
    {prompt || genre || mood ? matches.length ? <><p className="match-count" role="status">{matches.length} metadata {matches.length === 1 ? 'match' : 'matches'}</p><div className="movie-grid">{matches.map(({ movie, reason }, index) => <div key={movie.movie_id} className="match-result"><MovieCard movie={movie} index={index} favorite={favorites.includes(movie.movie_id)} selected={liked.includes(movie.movie_id)} onFavorite={onFavorite} onSelect={onSelect} onDetails={onDetails} theme="blue" tasteSelectionEnabled={movie.source === 'local'}/><p>Matched on: {reason.length ? reason.join(' Â· ') : 'selected metadata'}</p></div>)}</div></> : <EmptyPage title="No close matches yet." text="Try a broader description or another genre and mood."/> : <EmptyPage title="Set the scene." text="Enter a description, genre, or mood to match against available movie metadata."/>}
  </section>
}

export function SurprisePage({ movies, excludedIds, onDetails }: { movies: Movie[]; excludedIds: string[]; onDetails: (movie: Movie) => void }) {
  const [genre, setGenre] = useState('')
  const [picked, setPicked] = useState<Movie | null>(null)
  const [message, setMessage] = useState('')
  function surprise() {
    const candidates = movies.filter((movie) => (!genre || movie.genres.toLowerCase().includes(genre.toLowerCase())) && !excludedIds.includes(movie.movie_id))
    if (!candidates.length) { setPicked(null); setMessage('No eligible movies in the currently loaded catalog. Change the genre or browse more titles.'); return }
    setMessage(''); setPicked(candidates[Math.floor(Math.random() * candidates.length)])
  }
  return <section className="page-section surprise-page" aria-labelledby="surprise-title"><PageHeading eyebrow="LET FATE PICK THE FEATURE" title={<>One film. <em>No scrolling.</em></>} description="A random pick from the movies currently available in this catalog."/>
    <div className="surprise-controls"><label>Keep it in a genre<select value={genre} onChange={(event) => setGenre(event.target.value)}><option value="">Anything goes</option>{['Action','Adventure','Comedy','Drama','Mystery','Romance','Sci-Fi','Thriller','Western'].map((item) => <option key={item}>{item}</option>)}</select></label><button className="button button-primary" onClick={surprise}><Dice5 size={17}/> Surprise me</button></div>
    {message && <p className="recommendation-status" role="status">{message}</p>}{picked && <div className="surprise-pick"><div className={`surprise-poster poster-blue`}><Sparkles size={24}/><span>{picked.title}</span><small>{picked.release_year ?? 'Year unavailable'} Â· {picked.genres.split('|').join(' Â· ')}</small></div><div><div className="eyebrow"><span className="eyebrow-line"/> TONIGHT'S PICK</div><h3>{picked.title}</h3><p>{picked.overview || 'Overview unavailable for this title.'}</p><button className="button button-outline" onClick={() => onDetails(picked)}>View details<ArrowRight size={15}/></button><button className="text-button" onClick={surprise}><RotateCcw size={14}/> Roll again</button></div></div>}
  </section>
}

export function SettingsPage({ apiStatus, tmdbConfigured, demoUserId, motionEnabled, setMotionEnabled, highContrast, setHighContrast }: { apiStatus: string; tmdbConfigured: boolean; demoUserId: string; motionEnabled: boolean; setMotionEnabled: (value: boolean) => void; highContrast: boolean; setHighContrast: (value: boolean) => void }) {
  return <section className="page-section settings-page" aria-labelledby="settings-title"><PageHeading eyebrow="PREFERENCES & STATUS" title={<>Your viewing <em>room.</em></>} description="Browser preferences and non-sensitive service status. No API keys are exposed here."/>
    <div className="settings-list"><div><span><b>Reduced motion</b><small>Limit decorative animation in this browser.</small></span><label className="switch-control"><input type="checkbox" checked={!motionEnabled} onChange={(event) => setMotionEnabled(!event.target.checked)} aria-label="Enable reduced motion"/><i/></label></div><div><span><b>Higher contrast</b><small>Increase surface and text contrast.</small></span><label className="switch-control"><input type="checkbox" checked={highContrast} onChange={(event) => setHighContrast(event.target.checked)} aria-label="Enable higher contrast"/><i/></label></div><div><span><b>Backend</b><small>Health endpoint status</small></span><span className={`status-pill api-${apiStatus}`}>{apiStatus}</span></div><div><span><b>TMDB catalog</b><small>Popular and search routes</small></span><span className={`status-pill ${tmdbConfigured ? 'status-ok' : 'status-muted'}`}>{tmdbConfigured ? 'configured' : 'unavailable'}</span></div><div><span><b>Browser demo ID</b><small>Unauthenticated identifier used for feedback history.</small></span><code>{demoUserId}</code></div></div>
  </section>
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: ReactNode; description: string }) {
  return <div className="section-heading page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> {eyebrow}</div><h2>{title}</h2><p>{description}</p></div></div>
}

function ProfileStat({ label, value }: { label: string; value: number }) { return <div className="profile-stat"><span>{label}</span><b>{value}</b></div> }
function EmptyPage({ title, text }: { title: string; text: string }) { return <div className="empty-state"><span><Heart size={20}/></span><h3>{title}</h3><p>{text}</p></div> }
