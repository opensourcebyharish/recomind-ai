import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const testRequire = createRequire(import.meta.url)
const moduleLoader = testRequire('node:module')
const sourceFile = path.resolve('src/components/MovieMedia.tsx')
const originalLoad = moduleLoader._load
const compileTs = (module, filename) => {
  const source = testRequire('node:fs').readFileSync(filename, 'utf8')
  const js = ts.transpileModule(source, { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  module._compile(js, filename)
}
moduleLoader._extensions['.ts'] = compileTs
moduleLoader._extensions['.tsx'] = compileTs
moduleLoader._load = function (request, parent, isMain) {
  if (parent?.filename === sourceFile && request === '../services/api') {
    return { getTMDBCountries: async () => [], getTMDBMovieVideos: async () => ({ results: [] }), getTMDBWatchProviders: async () => ({ availability: null }) }
  }
  if (parent?.filename === sourceFile && request === 'react-dom') return { createPortal: (children) => children }
  if (request === 'framer-motion') return { AnimatePresence: ({ children }) => children, motion: { div: 'div', section: 'section' } }
  if (request === 'lucide-react') return new Proxy({}, { get: (_target, name) => (props) => React.createElement('svg', { ...props, 'data-icon': String(name) }) })
  return originalLoad.call(this, request, parent, isMain)
}

const media = testRequire(sourceFile)
const html = (element) => renderToStaticMarkup(element)
const video = { title: 'The First Voyage Â· Official Trailer', site: 'YouTube', key: 'official-key', type: 'Trailer', official: true }

test('trailer selection prefers official YouTube trailers', () => {
  const selected = media.chooseYoutubeTrailer([
    { ...video, key: 'unofficial', official: false },
    { ...video, key: 'featurette', type: 'Featurette' },
    video,
  ])
  assert.equal(selected.key, 'official-key')
})

test('trailer UI includes playback dialog and a direct YouTube link', () => {
  const section = html(React.createElement(media.TrailerSection, { state: 'loaded', trailer: video, error: '', onRetry() {}, onPlay() {} }))
  assert.match(section, /Watch Trailer/)
  assert.match(section, /The First Voyage/)

  const player = html(React.createElement(media.TrailerPlayerDialog, { trailer: video, failed: false, onFailed() {}, onClose() {} }))
  assert.match(player, /role="dialog"/)
  assert.match(player, /youtube-nocookie\.com\/embed\/official-key/)
  assert.match(player, /https:\/\/www\.youtube\.com\/watch\?v=official-key/)

  const fallback = html(React.createElement(media.TrailerPlayerDialog, { trailer: video, failed: true, onFailed() {}, onClose() {} }))
  assert.match(fallback, /embedded player could not load/i)
  assert.match(fallback, /Watch on YouTube/)
})

test('trailer component exposes loading, empty, and retryable error states', () => {
  const loading = html(React.createElement(media.TrailerSection, { state: 'loading', trailer: null, error: '', onRetry() {}, onPlay() {} }))
  const empty = html(React.createElement(media.TrailerSection, { state: 'loaded', trailer: null, error: '', onRetry() {}, onPlay() {} }))
  const error = html(React.createElement(media.TrailerSection, { state: 'error', trailer: null, error: 'TMDB unavailable', onRetry() {}, onPlay() {} }))
  assert.match(loading, /role="status"/)
  assert.match(empty, /No YouTube trailer is available/)
  assert.match(error, /role="alert"/)
  assert.match(error, /TMDB unavailable/)
  assert.match(error, /Retry/)
})

test('provider UI presents legal categories, logos, JustWatch link, and empty state', () => {
  const provider = { provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.png', display_priority: 1 }
  const availability = { flatrate: [provider], free: [], ads: [], rent: [{ ...provider, provider_id: 9, provider_name: 'Rental Cinema' }], buy: [] }
  const markup = html(React.createElement(media.ProviderGroups, { availability, link: 'https://www.justwatch.com/in/movie/example' }))
  assert.match(markup, /Subscription/)
  assert.match(markup, /Netflix/)
  assert.match(markup, /w92\/netflix\.png/)
  assert.match(markup, /Rent/)
  assert.match(markup, /View legal listings/)
  assert.match(markup, /rel="noopener noreferrer"/)

  const empty = html(React.createElement(media.ProviderGroups, { availability: null, link: null }))
  assert.match(empty, /No provider availability is listed for this region/)
})

test('watch availability component renders loading, country picker, and errors', () => {
  const props = { state: 'loading', region: 'IN', countries: [{ iso_3166_1: 'IN', english_name: 'India', native_name: 'à¤­à¤¾à¤°à¤¤' }], availability: null, link: null, error: '', onRegionChange() {}, onRetry() {} }
  assert.match(html(React.createElement(media.WatchAvailabilitySection, props)), /Checking legal availability/)
  const error = html(React.createElement(media.WatchAvailabilitySection, { ...props, state: 'error', error: 'Provider service unavailable' }))
  assert.match(error, /Provider service unavailable/)
  assert.match(error, /Retry/)
  assert.match(error, /Streaming availability country/)
  assert.match(error, /JustWatch/)
})

test.after(() => { moduleLoader._load = originalLoad })
