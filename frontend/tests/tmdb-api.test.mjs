import { test } from 'node:test'
import assert from 'node:assert/strict'

const originalFetch = globalThis.fetch
const apiBaseUrl = ''

function makeResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body
    },
  }
}

test('getTMDBStatus calls /api/tmdb/status', async () => {
  const calls = []
  globalThis.fetch = async (input) => {
    calls.push(String(input))
    return makeResponse({ configured: true, message: 'TMDB API configured' })
  }
  const { getTMDBStatus } = await import(`../src/services/api.ts?test=${Date.now()}`)
  const result = await getTMDBStatus()
  assert.equal(result.configured, true)
  assert.equal(calls[0], `${apiBaseUrl}/api/tmdb/status`)
  globalThis.fetch = originalFetch
})

test('getTMDBPopular calls /api/tmdb/popular with page', async () => {
  const calls = []
  globalThis.fetch = async (input) => {
    calls.push(String(input))
    return makeResponse({ page: 2, results: [], total_pages: 5, total_results: 100, source: 'tmdb', configured: true })
  }
  const { getTMDBPopular } = await import(`../src/services/api.ts?test=${Date.now()}`)
  const result = await getTMDBPopular(2)
  assert.equal(result.page, 2)
  assert.match(calls[0], /\/api\/tmdb\/popular\?page=2/)
  globalThis.fetch = originalFetch
})

test('searchTMDBMovies sends q parameter correctly', async () => {
  const calls = []
  globalThis.fetch = async (input) => {
    calls.push(String(input))
    return makeResponse({ page: 1, results: [], total_pages: 1, total_results: 0, source: 'tmdb', configured: true })
  }
  const { searchTMDBMovies } = await import(`../src/services/api.ts?test=${Date.now()}`)
  const result = await searchTMDBMovies('Inception', 1)
  assert.equal(result.page, 1)
  assert.match(calls[0], /\/api\/tmdb\/search\?q=Inception/)
  assert.ok(!calls[0].includes('query='))
  globalThis.fetch = originalFetch
})

test('searchTMDBMovies encodes query with special characters', async () => {
  const calls = []
  globalThis.fetch = async (input) => {
    calls.push(String(input))
    return makeResponse({ page: 1, results: [], total_pages: 1, total_results: 0, source: 'tmdb', configured: true })
  }
  const { searchTMDBMovies } = await import(`../src/services/api.ts?test=${Date.now()}`)
  await searchTMDBMovies('Star Wars: Episode IV', 1)
  assert.match(calls[0], /q=Star%20Wars/)
  globalThis.fetch = originalFetch
})

test('searchTMDBMovies includes page parameter', async () => {
  const calls = []
  globalThis.fetch = async (input) => {
    calls.push(String(input))
    return makeResponse({ page: 3, results: [], total_pages: 10, total_results: 200, source: 'tmdb', configured: true })
  }
  const { searchTMDBMovies } = await import(`../src/services/api.ts?test=${Date.now()}`)
  const result = await searchTMDBMovies('test', 3)
  assert.match(calls[0], /page=3/)
  assert.equal(result.page, 3)
  globalThis.fetch = originalFetch
})

test('getTMDBMovieVideos uses the backend TMDB-only videos route', async () => {
  const calls = []
  globalThis.fetch = async (input) => {
    calls.push(String(input))
    return makeResponse({ tmdb_movie_id: 123, results: [{ title: 'Official Trailer', site: 'YouTube', key: 'abc', type: 'Trailer', official: true }] })
  }
  const { getTMDBMovieVideos } = await import(`../src/services/api.ts?test=${Date.now()}`)
  const result = await getTMDBMovieVideos(123)
  assert.equal(result.results[0].official, true)
  assert.equal(calls[0], '/api/tmdb/movies/123/videos')
  globalThis.fetch = originalFetch
})

test('getTMDBWatchProviders sends the selected region and preserves JustWatch response', async () => {
  const calls = []
  globalThis.fetch = async (input) => {
    calls.push(String(input))
    return makeResponse({ tmdb_movie_id: 42, region: 'GB', link: 'https://www.justwatch.com/gb/movie/example', availability: null, source: 'JustWatch' })
  }
  const { getTMDBWatchProviders } = await import(`../src/services/api.ts?test=${Date.now()}`)
  const result = await getTMDBWatchProviders(42, 'GB')
  assert.equal(result.source, 'JustWatch')
  assert.equal(calls[0], '/api/tmdb/movies/42/watch-providers?region=GB')
  globalThis.fetch = originalFetch
})

test('getTMDBCountries requests the backend supported-region list', async () => {
  const calls = []
  globalThis.fetch = async (input) => {
    calls.push(String(input))
    return makeResponse([{ iso_3166_1: 'IN', english_name: 'India', native_name: 'à¤­à¤¾à¤°à¤¤' }])
  }
  const { getTMDBCountries } = await import(`../src/services/api.ts?test=${Date.now()}`)
  const result = await getTMDBCountries()
  assert.equal(result[0].iso_3166_1, 'IN')
  assert.equal(calls[0], '/api/tmdb/countries')
  globalThis.fetch = originalFetch
})

test('TMDB media service reports backend errors instead of hiding them', async () => {
  globalThis.fetch = async () => makeResponse({ detail: 'TMDB API error: 503' }, 502)
  const { getTMDBMovieVideos } = await import(`../src/services/api.ts?test=${Date.now()}`)
  await assert.rejects(getTMDBMovieVideos(123), /TMDB API error: 503/)
  globalThis.fetch = originalFetch
})
