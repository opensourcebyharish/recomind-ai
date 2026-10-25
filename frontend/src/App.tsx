import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { Activity, ArrowDown, ArrowRight, Bookmark, ChevronDown, Clapperboard, Compass, Dice5, Film, Heart, Menu, Search, Settings, SlidersHorizontal, Sparkles, Star, UserRound, X } from 'lucide-react'
import { MovieCard } from './components/MovieCard'
import { MovieDialog } from './components/MovieDialog'
import { RecommendationResults } from './components/RecommendationResults'
import { ActivityPage, MatchPage, SettingsPage, SurprisePage, TasteProfilePage, WatchlistPage, type WatchStatus } from './components/DiscoveryPages'
import { demoMovies, genres, posterThemes } from './data/movies'
import { ApiRequestError, getApiHealth, getFeedbackHistory, getPersonalizedRecommendations, getRecommendations, getTMDBPopular, getTMDBStatus, recordRecommendationInteraction, searchTMDBMovies, submitMovieFeedback, submitMovieRating } from './services/api'
import type { PersonalizedRecommendationItem } from './services/api'
import { getBrowserDemoUserId } from './services/feedbackProfile'
import { buildFeedbackRecommendationRequest } from './services/feedbackPersonalization'
import type { FeedbackResponse, Movie, MovieFeedbackType, RatingResponse, RecommendationItem, RecommendationResponse } from './types'
import type { TMDBMovie } from './types/tmdb'

type View = 'home' | 'discover' | 'for-you' | 'watchlist' | 'profile' | 'trending' | 'match' | 'surprise' | 'activity' | 'settings'
type ApiStatus = 'checking' | 'online' | 'offline'

function themeFor(movie: Pick<Movie, 'genres'>) {
  const genre = movie.genres?.split('|')[0] || 'Drama'
  return posterThemes[genre] ?? 'blue'
}

function mapTMDBToMovie(tmdb: TMDBMovie): Movie {
  const tmdbGenres: Record<number, string> = { 12: 'Adventure', 14: 'Fantasy', 16: 'Animation', 18: 'Drama', 27: 'Horror', 28: 'Action', 35: 'Comedy', 36: 'History', 37: 'Western', 53: 'Thriller', 80: 'Crime', 99: 'Documentary', 878: 'Sci-Fi', 9648: 'Mystery', 10402: 'Music', 10749: 'Romance', 10751: 'Family', 10752: 'War', 10770: 'TV Movie' }
  return {
    movie_id: `tmdb:${tmdb.tmdb_id}`,
    title: tmdb.title,
    genres: tmdb.genre_ids?.length ? tmdb.genre_ids.map((id) => tmdbGenres[id] ?? 'Movie').join('|') : (tmdb.genres || 'Movie'),
    overview: tmdb.overview,
    release_year: tmdb.release_year,
    vote_average: tmdb.vote_average,
    poster_url: tmdb.poster_url,
    backdrop_url: tmdb.backdrop_url,
    source: 'tmdb',
    tmdb_id: tmdb.tmdb_id,
  }
}

function readStored<T>(key: string, fallback: T): T {
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback }
}

function isLocalFeedbackMovie(id: string): boolean { return demoMovies.some((movie) => movie.movie_id === id) }

export default function App() {
  const [view, setView] = useState<View>('home')
  const [genre, setGenre] = useState('All films')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [favorites, setFavorites] = useState<string[]>(() => readStored('recomind-favorites', []))
  const [watchlist, setWatchlist] = useState<Record<string, WatchStatus>>(() => readStored('recomind-watchlist', {}))
  const [watchlistMovies, setWatchlistMovies] = useState<Movie[]>(() => readStored('recomind-watchlist-movies', []))
  const [liked, setLiked] = useState<string[]>([])
  const [tasteGenres, setTasteGenres] = useState<string[]>([])
  const [minimumRating, setMinimumRating] = useState(0)
  const [minYear, setMinYear] = useState(0)
  const [excludeFavorites, setExcludeFavorites] = useState(false)
  const [selectedMovie, setSelectedMovie] = useState<Movie | RecommendationItem | null>(null)
  const [userId] = useState(getBrowserDemoUserId)
  const [ratings, setRatings] = useState<Record<string, RatingResponse>>({})
  const [feedback, setFeedback] = useState<Record<string, FeedbackResponse>>({})
  const [feedbackStates, setFeedbackStates] = useState<Record<string, { busy: boolean; message: string; error: boolean }>>({})
  const [feedbackHistoryMessage, setFeedbackHistoryMessage] = useState('')
  const [recommendations, setRecommendations] = useState<RecommendationResponse | null>(null)
  const [hasRequestedRecommendations, setHasRequestedRecommendations] = useState(false)
  const [refreshBusy, setRefreshBusy] = useState(false)
  const [refreshMessage, setRefreshMessage] = useState('')
  const [refreshError, setRefreshError] = useState(false)
  const feedbackInFlight = useRef(new Set<string>())
  const refreshInFlight = useRef(false)
  const feedbackRevision = useRef(0)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [demoResults, setDemoResults] = useState(false)
  const [sortNewest, setSortNewest] = useState(false)
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking')
  const [tmdbConfigured, setTmdbConfigured] = useState(false)
  const [tmdbMovies, setTmdbMovies] = useState<Movie[]>([])
  const [tmdbPage, setTmdbPage] = useState(1)
  const [tmdbTotalPages, setTmdbTotalPages] = useState(1)
  const [tmdbReload, setTmdbReload] = useState(0)
  const [tmdbLoading, setTmdbLoading] = useState(false)
  const [tmdbError, setTmdbError] = useState<string | null>(null)
  const [useTmdb, setUseTmdb] = useState(true)
  const [personalizedRecs, setPersonalizedRecs] = useState<PersonalizedRecommendationItem[]>([])
  const [personalizedLoading, setPersonalizedLoading] = useState(false)
  const [personalizedError, setPersonalizedError] = useState<string | null>(null)
  const [personalizedStrategy, setPersonalizedStrategy] = useState<string>('')
  const [personalizedReload, setPersonalizedReload] = useState(0)
  const [feedbackVersion, setFeedbackVersion] = useState(0)
  const [activityInteractions, setActivityInteractions] = useState<import('./types').RecommendationInteractionResponse[]>([])
  const [interactionTrackingError, setInteractionTrackingError] = useState('')
  const interactionInFlight = useRef(new Set<string>())
  const [settingsMotion, setSettingsMotion] = useState(() => readStored('recomind-motion-enabled', true))
  const [settingsContrast, setSettingsContrast] = useState(() => readStored('recomind-high-contrast', false))

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  const catalog = useMemo(() => {
    if (useTmdb && tmdbConfigured && view !== 'watchlist') {
      return tmdbMovies
    }
    let items: Movie[] = demoMovies.map(m => ({...m, source: 'local' as const}))
    if (view === 'watchlist') {
      const byId = new Map([...demoMovies.map((movie) => ({ ...movie, source: 'local' as const })), ...watchlistMovies].map((movie) => [movie.movie_id, movie]))
      items = [...new Set([...favorites, ...Object.keys(watchlist)])].map((id) => byId.get(id)).filter((movie): movie is Movie => Boolean(movie))
    }
    if (sortNewest) items = [...items].sort((a, b) => (b.release_year || 0) - (a.release_year || 0))
    return items
  }, [favorites, watchlist, watchlistMovies, sortNewest, view, tmdbMovies, tmdbConfigured, useTmdb])

  const visibleMovies = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase()
    let items = (catalog as Movie[]).filter((movie) => {
      const movieGenres = movie.genres?.split('|') ?? []
      return (genre === 'All films' || movieGenres.includes(genre)) &&
        (!query || `${movie.title} ${movie.genres} ${movie.overview ?? ''}`.toLowerCase().includes(query)) &&
        (!minimumRating || (movie.vote_average ?? 0) >= minimumRating) &&
        (!minYear || (movie.release_year ?? 0) >= minYear)
    })
    if (demoResults && view !== 'watchlist') items = items.filter((movie) => {
      const movieGenres = movie.genres.split('|')
      return liked.some((id) => demoMovies.find((item) => item.movie_id === id)?.genres.split('|').some((value) => movieGenres.includes(value))) &&
        !liked.includes(movie.movie_id) && (tasteGenres.length === 0 || tasteGenres.some((value) => movieGenres.includes(value))) &&
        (!excludeFavorites || !favorites.includes(movie.movie_id))
    })
    if (sortNewest) items = [...items].sort((a, b) => (b.release_year ?? 0) - (a.release_year ?? 0))
    return items
  }, [catalog, debouncedSearch, demoResults, excludeFavorites, favorites, genre, liked, minYear, minimumRating, sortNewest, tasteGenres, view])

  const availableMovies = useMemo(() => {
    const all = [...demoMovies.map((movie) => ({ ...movie, source: 'local' as const })), ...tmdbMovies, ...watchlistMovies]
    return [...new Map(all.map((movie) => [movie.movie_id, movie])).values()]
  }, [tmdbMovies, watchlistMovies])
  const featuredMovie = tmdbConfigured && useTmdb ? tmdbMovies[0] : null

  useEffect(() => {
    const controller = new AbortController()
    getApiHealth(controller.signal).then(() => setApiStatus('online')).catch(() => {
      if (!controller.signal.aborted) setApiStatus('offline')
    })
    getTMDBStatus(controller.signal).then((status) => {
      setTmdbConfigured(status.configured)
      if (status.configured) setUseTmdb(true)
    }).catch(() => setTmdbConfigured(false))
    return () => controller.abort()
  }, [])

  // Load personalized recommendations
  useEffect(() => {
    const controller = new AbortController()
    setPersonalizedLoading(true)
    setPersonalizedError(null)
    getPersonalizedRecommendations(userId, 12, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return
        setPersonalizedRecs(res.recommendations)
        setPersonalizedStrategy(res.strategy)
        recordRecommendationViews(res.recommendations)
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setPersonalizedError(err instanceof ApiRequestError ? err.message : 'Failed to load personalized recommendations')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPersonalizedLoading(false)
      })
    return () => controller.abort()
  }, [userId, feedbackVersion, personalizedReload])

  // Load TMDB movies
  useEffect(() => {
    if (!tmdbConfigured || !useTmdb || !['home', 'discover', 'trending'].includes(view)) { setTmdbLoading(false); return }
    const controller = new AbortController()
    setTmdbLoading(true)
    setTmdbError(null)

    const loadMovies = async () => {
      try {
        let response
        if (debouncedSearch.trim()) {
          response = await searchTMDBMovies(debouncedSearch, tmdbPage, controller.signal)
        } else {
          response = await getTMDBPopular(tmdbPage, controller.signal)
        }
        const movies = response.results.map(mapTMDBToMovie)
        setWatchlistMovies((current) => {
          const known = new Set(current.map((movie) => movie.movie_id))
          return [...current, ...movies.filter((movie) => !known.has(movie.movie_id))]
        })
        if (tmdbPage === 1) {
          setTmdbMovies(movies)
        } else {
          setTmdbMovies(prev => [...prev, ...movies])
        }
        setTmdbTotalPages(response.total_pages)
      } catch (error) {
        if (!controller.signal.aborted) {
          setTmdbError(error instanceof ApiRequestError ? error.message : 'Failed to load TMDB movies')
        }
      } finally {
        if (!controller.signal.aborted) {
          setTmdbLoading(false)
        }
      }
    }

    loadMovies()
    return () => controller.abort()
  }, [tmdbConfigured, debouncedSearch, tmdbPage, tmdbReload, useTmdb, view])

  const loadMoreTMDB = () => {
    if (tmdbPage < tmdbTotalPages && !tmdbLoading) {
      setTmdbPage(p => p + 1)
    }
  }

  const resetTMDBSearch = () => {
    setSearch('')
    setDebouncedSearch('')
    setTmdbPage(1)
    setTmdbMovies([])
  }

  useEffect(() => {
    const controller = new AbortController()
    getFeedbackHistory(userId, controller.signal).then((history) => {
      setRatings((current) => ({ ...Object.fromEntries(history.ratings.map((item) => [item.movie_id, item])), ...current }))
      setFeedback((current) => ({ ...Object.fromEntries(history.feedback.filter((item) => isLocalFeedbackMovie(item.movie_id)).map((item) => [item.movie_id, item])), ...current }))
      setActivityInteractions((current) => {
        const merged = new Map(history.interactions.map((item) => [item.id, item]))
        current.forEach((item) => merged.set(item.id, item))
        return [...merged.values()]
      })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setFeedbackHistoryMessage(error instanceof ApiRequestError && [404, 405].includes(error.status ?? 0) ? 'Feedback is not available yet: the backend history endpoint is not implemented.' : 'Could not load saved feedback. You can still try submitting a rating or reaction.')
      }
    })
    return () => controller.abort()
  }, [userId])

  useEffect(() => { try { window.localStorage.setItem('recomind-favorites', JSON.stringify(favorites)) } catch { /* keep current session state */ } }, [favorites])
  useEffect(() => { try { window.localStorage.setItem('recomind-watchlist', JSON.stringify(watchlist)); window.localStorage.setItem('recomind-watchlist-movies', JSON.stringify(watchlistMovies)) } catch { /* keep current session state */ } }, [watchlist, watchlistMovies])
  useEffect(() => { document.documentElement.dataset.motion = settingsMotion ? 'on' : 'off'; document.documentElement.dataset.contrast = settingsContrast ? 'high' : 'normal'; try { window.localStorage.setItem('recomind-motion-enabled', JSON.stringify(settingsMotion)); window.localStorage.setItem('recomind-high-contrast', JSON.stringify(settingsContrast)) } catch { /* settings remain active for this session */ } }, [settingsMotion, settingsContrast])

  function toggleFavorite(id: string) { setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }
  function updateWatchlist(id: string, status: WatchStatus | null) { setWatchlist((current) => { const next = { ...current }; if (status) next[id] = status; else delete next[id]; return next }) }
  function toggleLiked(movie: Movie) {
    // Don't allow liking TMDB movies for recommendations (separate ID space)
    if (!isLocalFeedbackMovie(movie.movie_id)) return
    setLiked((current) => current.includes(movie.movie_id) ? current.filter((id) => id !== movie.movie_id) : [...current, movie.movie_id])
  }
  function trackInteraction(movieId: string, interactionType: 'click' | 'view') {
    const key = `${interactionType}:${movieId}`
    if (interactionInFlight.current.has(key)) return
    interactionInFlight.current.add(key)
    void recordRecommendationInteraction({ user_id: userId, movie_id: movieId, interaction_type: interactionType })
      .then((saved) => {
        setActivityInteractions((current) => current.some((item) => item.id === saved.id) ? current : [...current, saved])
      })
      .catch(() => setInteractionTrackingError('Some movie activity could not be saved. Recommendations still work; activity events do not affect ranking.'))
      .finally(() => interactionInFlight.current.delete(key))
  }
  function recordRecommendationViews(items: Array<{ movie_id: string }>) {
    for (const movieId of new Set(items.map((item) => item.movie_id))) trackInteraction(movieId, 'view')
  }
  function openMovieDetails(movie: Movie | RecommendationItem) {
    trackInteraction(movie.movie_id, 'click')
    setSelectedMovie(movie)
  }
  function startDemo() {
    setView('discover')
    setDemoResults(true)
    setUseTmdb(false)
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })
  }
  function selectView(next: View) {
    setView(next)
    setMobileMenu(false)
    setDemoResults(false)
    if (next === 'watchlist') setUseTmdb(false)
    else if (['home', 'discover', 'trending'].includes(next) && tmdbConfigured) setUseTmdb(true)
    if (['home', 'discover', 'trending'].includes(next)) { setTmdbPage(1); setTmdbMovies([]); if (next !== 'discover') { setSearch(''); setDebouncedSearch('') } setGenre('All films'); setMinYear(0); setMinimumRating(0) }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveRating(value: number) {
    if (!selectedMovie) return
    const movieId = selectedMovie.movie_id
    const isTMDB = !('explanation' in selectedMovie) && selectedMovie.source === 'tmdb'
    const catalog = isTMDB ? 'tmdb' : 'local'
    if (catalog === 'tmdb' && !/^tmdb:[1-9][0-9]*$/.test(movieId)) {
      setFeedbackStates((current) => ({ ...current, [movieId]: { busy: false, message: 'This TMDB title has an invalid catalog ID, so its rating was not submitted.', error: true } }))
      return
    }
    if (feedbackInFlight.current.has(movieId)) return
    feedbackInFlight.current.add(movieId)
    const updateStatus = (status: { busy: boolean; message: string; error: boolean }) => setFeedbackStates((current) => ({ ...current, [movieId]: status }))
    updateStatus({ busy: true, message: '', error: false })
    try {
      const saved = await submitMovieRating({ user_id: userId, catalog, movie_id: movieId, rating: value })
      setRatings((current) => ({ ...current, [saved.movie_id]: saved }))
      if (catalog === 'local') {
        feedbackRevision.current += 1
        setFeedbackVersion((version) => version + 1)
        setRecommendations(null)
        setHasRequestedRecommendations(false)
        setRefreshMessage('')
        setRefreshError(false)
      }
      updateStatus({ busy: false, message: 'Rating saved. You can change it any time.', error: false })
    }
    catch (error) { updateStatus({ busy: false, error: true, message: error instanceof ApiRequestError && [404, 405].includes(error.status ?? 0) ? 'This backend has not implemented the feedback rating endpoint yet. Nothing was saved.' : 'Could not save your rating. Check the API connection and try again.' }) }
    finally { feedbackInFlight.current.delete(movieId) }
  }

  async function saveReaction(type: MovieFeedbackType) {
    if (!selectedMovie) return
    const movieId = selectedMovie.movie_id
    // Don't submit TMDB IDs to feedback endpoints
    if (!isLocalFeedbackMovie(movieId)) {
      setFeedbackStates((current) => ({ ...current, [movieId]: { busy: false, message: 'TMDB catalog items use separate IDs. Feedback is available for local catalog items.', error: true } }))
      return
    }
    if (feedbackInFlight.current.has(movieId)) return
    feedbackInFlight.current.add(movieId)
    const updateStatus = (status: { busy: boolean; message: string; error: boolean }) => setFeedbackStates((current) => ({ ...current, [movieId]: status }))
    updateStatus({ busy: true, message: '', error: false })
    try { const saved = await submitMovieFeedback({ user_id: userId, movie_id: movieId, feedback_type: type }); setFeedback((current) => ({ ...current, [saved.movie_id]: saved })); feedbackRevision.current += 1; setFeedbackVersion((version) => version + 1); setRecommendations(null); setHasRequestedRecommendations(false); setRefreshMessage(''); setRefreshError(false); updateStatus({ busy: false, message: `${type === 'like' ? 'Like' : 'Dislike'} saved. You can change it any time.`, error: false }) }
    catch (error) { updateStatus({ busy: false, error: true, message: error instanceof ApiRequestError && [404, 405].includes(error.status ?? 0) ? 'This backend has not implemented the feedback endpoint yet. Nothing was saved.' : 'Could not save your reaction. Check the API connection and try again.' }) }
    finally { feedbackInFlight.current.delete(movieId) }
  }

  async function refreshRecommendations() {
    if (refreshInFlight.current) return
    const request = buildFeedbackRecommendationRequest({ feedback, ratings, tasteGenres, minimumRating, excludeFavorites, favorites, localMovieIds: demoMovies.map((movie) => movie.movie_id) })
    if (!request) { setRefreshError(true); setRefreshMessage('Add a Like or a 4â€“5 star rating first so the recommendation engine has a positive signal.'); return }
    refreshInFlight.current = true
    setHasRequestedRecommendations(true)
    const requestedRevision = feedbackRevision.current
    setRecommendations(null)
    setRefreshBusy(true); setRefreshMessage(''); setRefreshError(false)
    try {
      const response = await getRecommendations(request)
      if (requestedRevision !== feedbackRevision.current) { setRefreshError(true); setRefreshMessage('Your feedback changed while these were loading. Refresh again to include the latest changes.'); return }
      setRecommendations(response); setRefreshMessage(response.count ? `${response.count} recommendations refreshed from your feedback.` : 'Your feedback was saved, but the engine did not find matching titles. Try another Like or rating.'); setRefreshError(false)
      recordRecommendationViews(response.recommendations)
      document.getElementById('personalized-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch { setRefreshError(true); setRefreshMessage('Could not refresh recommendations. Check that the recommendation API is available and try again.') }
    finally { refreshInFlight.current = false; setRefreshBusy(false) }
  }

  return <MotionConfig reducedMotion={settingsMotion ? 'user' : 'always'}><div className="app-shell">
    <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
    <aside id="site-sidebar" className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#top" aria-label="RecoMind AI home"><span className="brand-mark"><Sparkles size={20}/></span><span>recomind<span className="brand-ai">.ai</span><small>YOUR NEXT FAVORITE, FOUND</small></span></a>
      <div className="nav-label">DISCOVER</div>
      <nav className="side-nav" aria-label="Main navigation">
        {([
          ['home', 'Home', Compass], ['discover', 'Discover', Search], ['trending', 'Popular on TMDB', Star], ['for-you', 'For you', Sparkles], ['match', 'AI movie match', Sparkles], ['surprise', 'Surprise me', Dice5], ['watchlist', 'My watchlist', Heart], ['profile', 'Taste profile', UserRound], ['activity', 'Activity', Activity], ['settings', 'Settings', Settings],
        ] as const).map(([key, label, Icon]) => <button key={key} className={`nav-item ${view === key ? 'nav-active' : ''}`} aria-current={view === key ? 'page' : undefined} onClick={() => selectView(key)}><Icon size={17}/>{label}{key === 'watchlist' && <span className="nav-count">{new Set([...favorites, ...Object.keys(watchlist)]).size}</span>}<span className="nav-active-mark"/></button>)}
      </nav>
      <div className="sidebar-rule"/><div className="nav-label">FIND YOUR MOOD</div>
       <div className="genre-nav">{['Sci-Fi', 'Thriller', 'Adventure', 'Romance'].map((item, i) => <button key={item} className={`genre-link ${genre === item ? 'genre-current' : ''}`} onClick={() => { selectView('discover'); setGenre(item) }}><span className={`genre-dot dot-${i}`}/>{item}</button>)}</div>
      <div className="sidebar-bottom"><div className="mini-mark"><Film size={16}/></div><p>Good stories find<br/>their way to you.</p><span>DISCOVERY ENGINE Â· DEMO</span></div>
    </aside>

    <main id="top" className="main-content">
      <header className="topbar"><button className="icon-button mobile-menu-button" aria-label={mobileMenu ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileMenu} aria-controls="site-sidebar" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X size={19}/> : <Menu size={19}/>}</button><div className="breadcrumb"><span>RECOMIND</span><span className="breadcrumb-slash">/</span><span>{view.toUpperCase().replace('-', ' ')}</span></div>{view !== 'home' && <form className="topbar-search" role="search" onSubmit={(event) => { event.preventDefault(); if (view !== 'discover') { setView('discover'); setDemoResults(false); setUseTmdb(tmdbConfigured); setMobileMenu(false) } setTmdbPage(1) }}><Search size={15}/><input aria-label="Search movies" placeholder={tmdbConfigured ? 'Search movies' : 'Search sample catalog'} value={search} onChange={(event) => setSearch(event.target.value)}/>{search && <button type="button" aria-label="Clear search" onClick={resetTMDBSearch}><X size={14}/></button>}</form>}<div className="topbar-right"><span className={`system-status api-${apiStatus}`} aria-live="polite" aria-label={`Backend API ${apiStatus}`}><span/> {apiStatus === 'checking' ? 'CHECKING API' : apiStatus === 'online' ? 'API ONLINE' : 'API OFFLINE'}</span><div className="avatar" aria-label="Browser demo profile">R</div></div></header>
      <AnimatePresence mode="wait" initial={false}><motion.div key={view} className="content-wrap" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: settingsMotion ? .22 : 0 }}>
        {view !== 'home' && <h1 className="visually-hidden">{view === 'for-you' ? 'For you' : view.replace('-', ' ')}</h1>}
        {view === 'home' && <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <motion.div className="eyebrow" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .5 }}><span className="eyebrow-line"/> A LITTLE MORE YOU, IN EVERY FRAME</motion.div>
            <motion.h1 id="hero-title" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08, duration: .65 }}>{featuredMovie ? <>{featuredMovie.title}<span>.</span></> : <>Discover beyond<br/>your <span>taste.</span></>}</motion.h1>
            <motion.p className="hero-description" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .22, duration: .6 }}>A new perspective on movie night. Explore stories that meet your taste â€” and take it somewhere unexpected.</motion.p>
            <motion.form className="search-box" role="search" onSubmit={(event) => { event.preventDefault(); setTmdbPage(1); setTmdbMovies([]); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }) }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3, duration: .5 }}>
              <Search size={18}/><input aria-label="Search movies" placeholder={tmdbConfigured ? "Search TMDB movies..." : "Find a film, a feeling, a genre..."} value={search} onChange={(event) => { setSearch(event.target.value); setDemoResults(false); setTmdbPage(1); setTmdbMovies([]); if (tmdbConfigured) setUseTmdb(true); }} />{search && <button type="button" className="clear-search" aria-label="Clear search" onClick={resetTMDBSearch}><X size={15}/></button>}<button type="submit" className="search-submit" aria-label="Search"><ArrowRight size={18}/></button>
            </motion.form>
            <motion.div className="hero-actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .4 }}><button className="button button-primary" onClick={() => document.getElementById('taste')?.scrollIntoView({ behavior: 'smooth' })}><Sparkles size={16}/>Build your taste <ArrowRight size={15}/></button><button className="text-button" onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}>Explore the collection <ArrowDown size={14}/></button></motion.div>
            <div className="hero-caption"><span className="caption-rule"/><span>MADE FOR YOUR NEXT â€œONE MOREâ€</span></div>
          </div>
          <motion.div className="hero-art" initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .9, ease: [.2,.8,.2,1] }}>
            <div className={`hero-frame ${featuredMovie?.backdrop_url ? 'hero-frame-live' : ''}`} style={featuredMovie?.backdrop_url ? { backgroundImage: `linear-gradient(0deg,rgba(5,7,12,.68),transparent 75%),url(${featuredMovie.backdrop_url})` } : undefined} role="img" aria-label={featuredMovie?.backdrop_url ? `Featured film artwork for ${featuredMovie.title}` : 'Illustrated cinematic artwork: a lone traveler beneath a luminous moon'}>{!featuredMovie?.backdrop_url && <><div className="hero-moon"/><div className="hero-halo"/><div className="hero-ridge ridge-back"/><div className="hero-ridge ridge-mid"/><div className="hero-ridge ridge-front"/><div className="hero-traveler"><span/></div><div className="hero-art-grain"/><div className="hero-art-vignette"/></>}<div className="hero-art-label"><span>{featuredMovie ? 'TMDB FEATURE' : '01 / 20'}</span><span>{featuredMovie ? 'POPULAR RIGHT NOW' : 'AN OPENING SCENE'}</span></div></div>
            <div className="art-side-label">STORIES IN A NEW LIGHT <span>âœ³</span></div><div className="floating-note"><span className="note-icon"><Clapperboard size={15}/></span><span><b>Tonightâ€™s feeling</b><small>Something otherworldly</small></span><span className="note-spark">âœ³</span></div>
          </motion.div>
          <span className="hero-index">01 <i/> 04</span>
        </section>}

        {view === 'home' && !tmdbConfigured && <div className="demo-banner"><span className="demo-banner-icon"><Film size={15}/></span><span><b>Exploring the demo catalog</b><span>Sample titles and catalog ratings are illustrative. Rate a title to request live recommendations from the engine.</span></span><span className="demo-pill">DEMO DATA</span></div>}

        {(view === 'home' || view === 'for-you') && <section className="taste-section" id="taste">
          <div className="section-heading taste-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR TASTE, YOUR CALL</div><h2>Start with a few <em>favorites.</em></h2><p>Pick films you love. Weâ€™ll use them to shape a demo exploration from this sample catalog.</p></div><span className="step-indicator"><span>01</span> / 02</span></div>
          <div className="taste-controls"><div className="taste-count"><span className="taste-count-number">{String(liked.length).padStart(2, '0')}</span><span>FILMS SELECTED<br/><small>Pick at least one to explore</small></span>{liked.length > 0 && <button className="reset-taste" onClick={() => { setLiked([]); setDemoResults(false) }}>Clear selection</button>}</div><button className="button button-primary taste-cta" disabled={liked.length === 0} onClick={startDemo}><Sparkles size={16}/>Preview demo matches<ArrowRight size={16}/></button></div>
          <div className="preference-controls"><fieldset><legend>EXPLORE GENRES <small>OPTIONAL</small></legend><div className="preference-pills">{genres.slice(1).map((item) => <button key={item} type="button" className={`genre-pill ${tasteGenres.includes(item) ? 'pill-active' : ''}`} aria-pressed={tasteGenres.includes(item)} onClick={() => setTasteGenres((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])}>{item}</button>)}</div></fieldset><label className="rating-filter">MIN CATALOG RATING<select value={minimumRating} onChange={(event) => setMinimumRating(Number(event.target.value))}><option value={0}>Any rating</option><option value={7.5}>7.5+</option><option value={8}>8.0+</option></select></label><label className="exclude-filter"><input type="checkbox" checked={excludeFavorites} onChange={(event) => setExcludeFavorites(event.target.checked)}/> Exclude saved films</label></div>
          {demoResults && <motion.div className="demo-result-note" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><Sparkles size={15}/><span><b>Illustrative demo exploration</b> â€” titles share a genre with your selections. This is not a live recommendation from the engine.</span><button onClick={() => setDemoResults(false)}>Clear preview</button></motion.div>}
        </section>}

        {hasRequestedRecommendations && <RecommendationResults items={recommendations?.recommendations ?? []} favoriteIds={favorites} onDetails={openMovieDetails} onFavorite={toggleFavorite} loading={refreshBusy} message={refreshMessage} error={refreshError} onRefresh={refreshRecommendations}/>}

        {(view === 'home' || view === 'for-you') && <section className="personalized-results" aria-labelledby="personalized-hybrid-title" id="personalized-hybrid">
          <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> PERSONALIZED FOR YOU</div><h2 id="personalized-hybrid-title">Your next <em>favorites.</em></h2><p>{personalizedStrategy === 'metadata_seeded_content_fallback' ? 'No positive local feedback is available yet. These content matches use a seed selected by catalog rating and release year, so they are not personalized.' : 'These content matches use your local likes and 4â€“5 star ratings. Disliked and previously rated titles are excluded.'} Activity events appear in Activity but do not affect ranking. Strategy: {personalizedStrategy.replace(/_/g, ' ')}</p></div><button className="button button-outline" onClick={() => setPersonalizedReload((value) => value + 1)} disabled={personalizedLoading}><Sparkles size={15}/> Refresh</button></div>
          {personalizedLoading && <p className="recommendation-status" role="status">Loading personalized recommendations...</p>}
          {personalizedError && <p className="recommendation-status feedback-error" role="alert">{personalizedError} <button className="text-button" onClick={() => setPersonalizedReload((value) => value + 1)}>Retry</button></p>}
          {!personalizedLoading && !personalizedError && personalizedRecs.length === 0 && <div className="empty-state"><h3>No personalized matches yet.</h3><p>Rate or react to a few local sample titles, then refresh your feedback recommendations.</p></div>}
          {!personalizedLoading && !personalizedError && personalizedRecs.length > 0 && <div className="recommendation-grid">{personalizedRecs.map((item, index) => <motion.article className={`recommendation-card poster-${['blue', 'rose', 'amber', 'violet'][index % 4]}`} key={item.movie_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .04 }}>
            <div className="recommendation-art"><span className="recommendation-art-glow"/><span className="recommendation-index">{String(index + 1).padStart(2, '0')}</span><span className="recommendation-title-art">{item.title}</span><span className="recommendation-genres">{item.genres.split('|').join(' Â· ')}</span></div>
            <div className="recommendation-copy"><div className="recommendation-meta">{item.release_year ?? 'Year unavailable'}{item.vote_average !== null && <span>â˜… {item.vote_average.toFixed(1)}</span>}<span>{item.source}</span></div><p>{item.explanation}</p><div className="recommendation-actions"><button className="button button-outline" onClick={() => openMovieDetails({ movie_id: item.movie_id, title: item.title, genres: item.genres, overview: item.explanation, release_year: item.release_year, vote_average: item.vote_average, source: item.source === 'collaborative' ? 'movielens' : item.source === 'hybrid' ? 'hybrid' : 'local', recommendation_source: item.source })}>Details<ArrowRight size={14}/></button><button className={`icon-button ${favorites.includes(item.movie_id) ? 'favorite-active' : ''}`} aria-label={`Save ${item.title} to favorites`} aria-pressed={favorites.includes(item.movie_id)} onClick={() => toggleFavorite(item.movie_id)}><Heart size={17} fill={favorites.includes(item.movie_id) ? 'currentColor' : 'none'}/></button></div></div>
          </motion.article>)}</div>}
        </section>}

        {view === 'watchlist' && <WatchlistPage movies={availableMovies} favorites={favorites} watchlist={watchlist} onFavorite={toggleFavorite} onWatchlist={updateWatchlist} onDetails={openMovieDetails} liked={liked} onSelect={toggleLiked}/>}
        {view === 'profile' && <TasteProfilePage ratings={ratings} feedback={feedback} favorites={favorites} localMovies={demoMovies}/>}
        {view === 'activity' && <ActivityPage ratings={ratings} feedback={feedback} interactions={activityInteractions} movies={availableMovies} interactionError={interactionTrackingError}/>}
        {view === 'match' && <MatchPage movies={availableMovies} onDetails={openMovieDetails} favorites={favorites} onFavorite={toggleFavorite} liked={liked} onSelect={toggleLiked}/>}
        {view === 'surprise' && <SurprisePage movies={tmdbConfigured && useTmdb ? tmdbMovies : demoMovies.map((movie) => ({ ...movie, source: 'local' as const }))} excludedIds={Object.keys(feedback).filter((id) => feedback[id].feedback_type === 'dislike')} onDetails={openMovieDetails}/>}
        {view === 'settings' && <SettingsPage apiStatus={apiStatus} tmdbConfigured={tmdbConfigured} demoUserId={userId} motionEnabled={settingsMotion} setMotionEnabled={setSettingsMotion} highContrast={settingsContrast} setHighContrast={setSettingsContrast}/>}

        {['home', 'discover', 'trending'].includes(view) && <section className="catalog-section" id="catalog">
          <div className="section-heading catalog-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> {tmdbConfigured && useTmdb && !demoResults ? 'TMDB DISCOVERY' : 'A SMALL WORLD OF STORIES'}</div><h2>{demoResults ? <>A few places to <em>begin.</em></> : tmdbConfigured && useTmdb ? <>Discover <em>popular films.</em></> : <>The demo <em>collection.</em></>}</h2><p>{tmdbConfigured && useTmdb && !demoResults ? 'Real movies from TMDB. Search and browse popular titles.' : 'Twenty original sample titles. Filter by genre, follow a thread, see where it leads.'}</p></div><div className="catalog-count">{String(visibleMovies.length).padStart(2, '0')} <span>FILMS</span></div></div>
          {tmdbConfigured && useTmdb && !demoResults && (
            <div style={{marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', fontSize: '0.875rem'}}>
              <strong>TMDB Catalog</strong> Â· This product uses the TMDB API but is not endorsed or certified by TMDB.
            </div>
          )}
          <div className="catalog-toolbar"><div className="genre-pills" role="group" aria-label="Filter by genre">{genres.map((item) => <button key={item} className={`genre-pill ${genre === item ? 'pill-active' : ''}`} aria-pressed={genre === item} onClick={() => { setGenre(item); setDemoResults(false) }}>{item}</button>)}</div><div className="catalog-filters"><label>MIN RATING<select value={minimumRating} onChange={(event) => setMinimumRating(Number(event.target.value))}><option value={0}>Any</option><option value={7}>7+</option><option value={8}>8+</option></select></label><label>FROM YEAR<input aria-label="Filter from release year" type="number" min="1900" max="2100" value={minYear || ''} placeholder="Any" onChange={(event) => setMinYear(Math.max(0, Number(event.target.value) || 0))}/></label><div className="sort-controls"><span><SlidersHorizontal size={14}/> SORT</span><button className="sort-button" aria-label={`Sort order: ${sortNewest ? 'newest first' : 'curated order'}`} onClick={() => setSortNewest(!sortNewest)}>{sortNewest ? 'Newest first' : 'Curated order'}<ChevronDown size={14}/></button></div><button className="text-button reset-filters" onClick={() => { setGenre('All films'); setMinimumRating(0); setMinYear(0); setSortNewest(false) }}>Reset filters</button></div></div>
          {tmdbLoading && tmdbPage === 1 && <p className="recommendation-status" role="status">Loading TMDB catalogâ€¦</p>}
          {tmdbError && <p className="recommendation-status feedback-error" role="alert">{tmdbError} <button onClick={() => { setTmdbPage(1); setTmdbMovies([]); setTmdbReload((value) => value + 1); }} style={{marginLeft: '0.5rem', textDecoration: 'underline'}}>Retry</button></p>}
          <AnimatePresence mode="wait"><motion.div key={`${view}-${genre}-${debouncedSearch}-${demoResults}-${sortNewest}`} className="movie-grid" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .22 }}>
            {visibleMovies.map((movie, index) => <MovieCard key={movie.movie_id} movie={movie} index={index} favorite={favorites.includes(movie.movie_id)} selected={liked.includes(movie.movie_id)} onFavorite={toggleFavorite} onSelect={toggleLiked} onDetails={openMovieDetails} theme={themeFor(movie)} tasteSelectionEnabled={isLocalFeedbackMovie(movie.movie_id)}/>)}
          </motion.div></AnimatePresence>
          {tmdbConfigured && useTmdb && !demoResults && tmdbPage < tmdbTotalPages && !tmdbLoading && (
            <div style={{textAlign: 'center', marginTop: '2rem'}}>
              <button className="button button-outline" onClick={loadMoreTMDB}>Load More</button>
            </div>
          )}
          {tmdbLoading && tmdbPage > 1 && <p className="recommendation-status" role="status">Loading moreâ€¦</p>}
          {visibleMovies.length === 0 && !tmdbLoading && !tmdbError && <div className="empty-state"><span><Bookmark size={20}/></span><h3>{demoResults ? 'No demo titles fit this mix.' : debouncedSearch ? 'No results found.' : 'No stories found.'}</h3><p>{demoResults ? 'Loosen a genre or rating preference, or choose different favorites.' : debouncedSearch ? 'Try a different search term.' : 'Try a different title or genre to keep exploring.'}</p>{demoResults && <button className="button button-outline" onClick={() => { setTasteGenres([]); setMinimumRating(0); setExcludeFavorites(false) }}>Reset preview filters</button>}</div>}
          <div className="catalog-footnote"><span className="caption-rule"/> {tmdbConfigured && useTmdb && !demoResults ? 'TMDB CATALOG' : 'THE COLLECTION IS A SYNTHETIC SAMPLE DATASET'} <span>{tmdbConfigured && useTmdb && !demoResults ? 'REAL MOVIE DATA' : '20 TITLES Â· FOR DEMONSTRATION'}</span></div>
        </section>}

        {view === 'home' && <><section className="closing-note"><div className="closing-orbit orbit-a"/><div className="closing-orbit orbit-b"/><div className="eyebrow"><span className="eyebrow-line"/> THE STORY CONTINUES</div><h2>Your next favorite<br/>is <em>out there.</em></h2><p>And one day, finding it will feel like the opening scene.</p><button className="button button-outline" onClick={() => selectView('discover')}>Back to discovery <ArrowRight size={15}/></button></section>
        <footer className="footer"><a className="footer-brand" href="#top"><Sparkles size={15}/> recomind<span>.ai</span></a><span>DISCOVER BEYOND YOUR TASTE</span><span>DEMO EXPERIENCE Â· 2026</span></footer></>}
      </motion.div></AnimatePresence>
    </main>
    {mobileMenu && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)}/>}
    <MovieDialog movie={selectedMovie} favorite={selectedMovie ? favorites.includes(selectedMovie.movie_id) : false} onClose={() => setSelectedMovie(null)} onFavorite={toggleFavorite} watchStatus={selectedMovie ? watchlist[selectedMovie.movie_id] ?? null : null} onWatchlist={updateWatchlist} ratingCompatible={Boolean(selectedMovie && (isLocalFeedbackMovie(selectedMovie.movie_id) || (!('explanation' in selectedMovie) && selectedMovie.source === 'tmdb' && selectedMovie.tmdb_id)))} feedbackCompatible={Boolean(selectedMovie && isLocalFeedbackMovie(selectedMovie.movie_id))} theme={selectedMovie ? themeFor(selectedMovie) : 'blue'} rating={selectedMovie ? ratings[selectedMovie.movie_id] ?? null : null} feedback={selectedMovie ? feedback[selectedMovie.movie_id] ?? null : null} feedbackBusy={selectedMovie ? feedbackStates[selectedMovie.movie_id]?.busy ?? false : false} feedbackMessage={selectedMovie ? feedbackStates[selectedMovie.movie_id]?.message ?? feedbackHistoryMessage : feedbackHistoryMessage} feedbackError={selectedMovie ? feedbackStates[selectedMovie.movie_id]?.error ?? Boolean(feedbackHistoryMessage) : Boolean(feedbackHistoryMessage)} onRate={saveRating} onFeedback={saveReaction} canRefresh={Object.values(feedback).some((item) => item.feedback_type === 'like') || Object.values(ratings).some((item) => item.catalog === 'local' && item.rating >= 4)} refreshBusy={refreshBusy} refreshMessage={refreshMessage} refreshError={refreshError} onRefresh={refreshRecommendations}/>
  </div></MotionConfig>
}
