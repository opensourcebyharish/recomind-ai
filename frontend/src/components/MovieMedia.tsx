import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink, Play, RotateCw, X } from 'lucide-react'
import { getTMDBCountries, getTMDBMovieVideos, getTMDBWatchProviders } from '../services/api'
import type { TMDBCountry, TMDBVideo, TMDBVideosResponse, TMDBWatchAvailability, TMDBWatchProvidersResponse } from '../types/tmdb'

type LoadState = 'loading' | 'loaded' | 'error'
type Trailer = TMDBVideo

export function chooseYoutubeTrailer(videos: TMDBVideo[]): Trailer | null {
  return videos
    .filter((video) => video.site.toLowerCase() === 'youtube' && video.type.toLowerCase() === 'trailer' && video.key.trim())
    .sort((a, b) => Number(b.official) - Number(a.official))[0] ?? null
}

export function TrailerSection({ state, trailer, error, onRetry, onPlay }: {
  state: LoadState
  trailer: Trailer | null
  error: string
  onRetry: () => void
  onPlay: () => void
}) {
  return <section className="movie-media-section" aria-labelledby="trailer-heading">
    <div className="movie-media-heading"><div><span className="media-kicker">PREVIEW</span><h3 id="trailer-heading">Watch trailer</h3></div>
      {trailer && <button className="button button-outline trailer-action" onClick={onPlay}><Play size={14} fill="currentColor"/> Watch Trailer</button>}
    </div>
    {state === 'loading' && <p className="media-state" role="status">Finding an official trailerâ€¦</p>}
    {state === 'error' && <div className="media-error" role="alert"><span>{error || 'Trailer information could not be loaded.'}</span><button className="text-button" onClick={onRetry}><RotateCw size={13}/> Retry</button></div>}
    {state === 'loaded' && !trailer && <p className="media-state">No YouTube trailer is available for this title.</p>}
    {state === 'loaded' && trailer && <p className="media-caption">{trailer.title}{trailer.official ? ' Â· Official' : ''} <span>Â· YouTube</span></p>}
  </section>
}

const providerGroups: Array<[keyof TMDBWatchAvailability, string]> = [
  ['flatrate', 'Subscription'], ['free', 'Free'], ['ads', 'Ad-supported'], ['rent', 'Rent'], ['buy', 'Buy'],
]

export function ProviderGroups({ availability, link }: { availability: TMDBWatchAvailability | null; link: string | null }) {
  const availableGroups = providerGroups.filter(([key]) => (availability?.[key].length ?? 0) > 0)
  if (!availableGroups.length) return <p className="media-state">No provider availability is listed for this region.</p>
  return <>
    <div className="provider-groups">{availableGroups.map(([key, label]) => <section className="provider-group" key={key} aria-label={`${label} providers`}>
      <h4>{label}</h4><ul>{availability?.[key].map((provider) => <li key={`${key}-${provider.provider_id}`}>
        {provider.logo_path ? <img src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`} alt="" loading="lazy"/> : <span className="provider-logo-fallback" aria-hidden="true">{provider.provider_name.slice(0, 1)}</span>}
        <span>{provider.provider_name}</span>
      </li>)}</ul>
    </section>)}</div>
    {link && <a className="button button-outline provider-link" href={link} target="_blank" rel="noopener noreferrer">View legal listings <ExternalLink size={13}/></a>}
  </>
}

export function WatchAvailabilitySection({ state, region, countries, availability, link, error, onRegionChange, onRetry }: {
  state: LoadState
  region: string
  countries: TMDBCountry[]
  availability: TMDBWatchAvailability | null
  link: string | null
  error: string
  onRegionChange: (region: string) => void
  onRetry: () => void
}) {
  return <section className="movie-media-section watch-availability" aria-labelledby="availability-heading">
    <div className="movie-media-heading"><div><span className="media-kicker">LEGAL STREAMING</span><h3 id="availability-heading">Where to watch</h3></div>
      <label className="region-picker"><span className="sr-only">Streaming availability country</span><select value={region} onChange={(event) => onRegionChange(event.target.value)}>
        {!countries.some((country) => country.iso_3166_1 === region) && <option value={region}>{region === 'IN' ? 'India' : region}</option>}
        {countries.map((country) => <option key={country.iso_3166_1} value={country.iso_3166_1}>{country.english_name}</option>)}
      </select></label>
    </div>
    {state === 'loading' && <p className="media-state" role="status">Checking legal availabilityâ€¦</p>}
    {state === 'error' && <div className="media-error" role="alert"><span>{error || 'Availability could not be loaded.'}</span><button className="text-button" onClick={onRetry}><RotateCw size={13}/> Retry</button></div>}
    {state === 'loaded' && <ProviderGroups availability={availability} link={link}/>}
    <p className="justwatch-credit">Availability data by JustWatch via TMDB.</p>
  </section>
}

export function TrailerPlayerDialog({ trailer, failed, onFailed, onClose }: {
  trailer: Trailer
  failed: boolean
  onFailed: () => void
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); return }
      if (event.key !== 'Tab') return
      const dialog = document.querySelector<HTMLElement>('[data-trailer-dialog]')
      const controls = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], iframe')
      if (!controls?.length) return
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown); previousFocus.current?.focus() }
  }, [onClose])

  const youtubeUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`
  const dialogContent = <AnimatePresence>
    <motion.div className="trailer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section className="trailer-dialog" role="dialog" aria-modal="true" aria-labelledby="trailer-dialog-title" data-trailer-dialog initial={{ opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}>
        <div className="trailer-dialog-heading"><div><span className="media-kicker">YOUTUBE TRAILER</span><h2 id="trailer-dialog-title">{trailer.title}</h2></div><button ref={closeRef} className="icon-button" aria-label="Close trailer" onClick={onClose}><X size={18}/></button></div>
        {failed ? <div className="trailer-embed-error" role="alert"><p>The embedded player could not load. You can open this trailer on YouTube.</p><a className="button button-primary" href={youtubeUrl} target="_blank" rel="noopener noreferrer">Watch on YouTube <ExternalLink size={14}/></a></div> : <div className="trailer-frame-wrap"><iframe title={`${trailer.title} YouTube trailer`} src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}?autoplay=1&rel=0`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen onError={onFailed}/></div>}
        {!failed && <a className="trailer-youtube-link" href={youtubeUrl} target="_blank" rel="noopener noreferrer">Open on YouTube <ExternalLink size={13}/></a>}
      </motion.section>
    </motion.div>
  </AnimatePresence>
  return typeof document === 'undefined' ? dialogContent : createPortal(dialogContent, document.body)
}

export function MovieMedia({ tmdbMovieId, onTrailerOpenChange }: { tmdbMovieId: number; onTrailerOpenChange: (open: boolean) => void }) {
  const [videosState, setVideosState] = useState<LoadState>('loading')
  const [videos, setVideos] = useState<TMDBVideo[]>([])
  const [videosError, setVideosError] = useState('')
  const [selectedTrailer, setSelectedTrailer] = useState<Trailer | null>(null)
  const [embedFailed, setEmbedFailed] = useState(false)
  const [region, setRegion] = useState('IN')
  const [countries, setCountries] = useState<TMDBCountry[]>([{ iso_3166_1: 'IN', english_name: 'India', native_name: 'à¤­à¤¾à¤°à¤¤' }])
  const [providersState, setProvidersState] = useState<LoadState>('loading')
  const [providers, setProviders] = useState<TMDBWatchProvidersResponse | null>(null)
  const [providersError, setProvidersError] = useState('')
  const [videosRetry, setVideosRetry] = useState(0)
  const [providersRetry, setProvidersRetry] = useState(0)
  const trailer = useMemo(() => chooseYoutubeTrailer(videos), [videos])

  useEffect(() => {
    const controller = new AbortController()
    setVideosState('loading'); setVideosError(''); setVideos([])
    getTMDBMovieVideos(tmdbMovieId, controller.signal).then((response: TMDBVideosResponse) => {
      if (!controller.signal.aborted) { setVideos(response.results); setVideosState('loaded') }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) { setVideosError(error instanceof Error ? error.message : 'Trailer information could not be loaded.'); setVideosState('error') }
    })
    return () => controller.abort()
  }, [tmdbMovieId, videosRetry])

  useEffect(() => {
    const controller = new AbortController()
    getTMDBCountries(controller.signal).then((response) => {
      if (!controller.signal.aborted) {
        const byCode = new Map(response.map((country) => [country.iso_3166_1, country]))
        byCode.set('IN', byCode.get('IN') ?? { iso_3166_1: 'IN', english_name: 'India', native_name: 'à¤­à¤¾à¤°à¤¤' })
        setCountries([...byCode.values()].sort((a, b) => a.english_name.localeCompare(b.english_name)))
      }
    }).catch(() => { /* Keep the India default available if region metadata is temporarily unavailable. */ })
    return () => controller.abort()
  }, [tmdbMovieId])

  useEffect(() => {
    const controller = new AbortController()
    setProvidersState('loading'); setProvidersError(''); setProviders(null)
    getTMDBWatchProviders(tmdbMovieId, region, controller.signal).then((response) => {
      if (!controller.signal.aborted) { setProviders(response); setProvidersState('loaded') }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) { setProvidersError(error instanceof Error ? error.message : 'Availability could not be loaded.'); setProvidersState('error') }
    })
    return () => controller.abort()
  }, [tmdbMovieId, region, providersRetry])

  const retryVideos = useCallback(() => setVideosRetry((value) => value + 1), [])
  const retryProviders = useCallback(() => setProvidersRetry((value) => value + 1), [])
  const closeTrailer = useCallback(() => { setSelectedTrailer(null); onTrailerOpenChange(false) }, [onTrailerOpenChange])

  return <div className="movie-media">
    <TrailerSection state={videosState} trailer={trailer} error={videosError} onRetry={retryVideos} onPlay={() => { if (trailer) { setEmbedFailed(false); setSelectedTrailer(trailer); onTrailerOpenChange(true) } }}/>
    <WatchAvailabilitySection state={providers?.region === region ? providersState : 'loading'} region={region} countries={countries} availability={providers?.region === region ? providers.availability : null} link={providers?.region === region ? providers.link : null} error={providersError} onRegionChange={setRegion} onRetry={retryProviders}/>
    <AnimatePresence>{selectedTrailer && <TrailerPlayerDialog trailer={selectedTrailer} failed={embedFailed} onFailed={() => setEmbedFailed(true)} onClose={closeTrailer}/>}</AnimatePresence>
  </div>
}
