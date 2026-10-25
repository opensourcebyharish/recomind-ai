import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

async function importTypeScript(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

const api = await importTypeScript('../src/services/api.ts')

function mockFetch(body) {
  const calls = []
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return calls
}

test('rating uses POST /api/feedback/rating and passes the backend schema unchanged', async () => {
  const request = { user_id: 'browser-demo-abc', catalog: 'local', movie_id: 'm001', rating: 4 }
  const responseBody = { id: 8, ...request, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }
  const calls = mockFetch(responseBody)
  assert.deepEqual(await api.submitMovieRating(request), responseBody)
  assert.equal(calls[0].url, '/api/feedback/rating')
  assert.equal(calls[0].init.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].init.body), request)
})

test('TMDB ratings carry an explicit catalog and namespaced movie ID', async () => {
  const request = { user_id: 'browser-demo-abc', catalog: 'tmdb', movie_id: 'tmdb:550', rating: 4 }
  const calls = mockFetch({ id: 12, ...request, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' })
  const saved = await api.submitMovieRating(request)
  assert.equal(saved.catalog, 'tmdb')
  assert.equal(calls[0].url, '/api/feedback/rating')
  assert.deepEqual(JSON.parse(calls[0].init.body), request)
})

test('like and dislike use their dedicated POST routes and the feedback_type schema', async () => {
  for (const feedback_type of ['like', 'dislike']) {
    const request = { user_id: 'browser-demo-abc', movie_id: 'm002', feedback_type }
    const calls = mockFetch({ id: 9, ...request, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' })
    await api.submitMovieFeedback(request)
    assert.equal(calls[0].url, `/api/feedback/${feedback_type}`)
    assert.equal(calls[0].init.method, 'POST')
    assert.deepEqual(JSON.parse(calls[0].init.body), request)
  }
})

test('interaction tracking uses POST /api/feedback/interaction and returns the persisted event', async () => {
  const request = { user_id: 'browser-demo-abc', movie_id: 'tmdb:42', interaction_type: 'click' }
  const responseBody = { status: 'ok', id: 12, movie_id: request.movie_id, interaction_type: request.interaction_type, created_at: '2026-01-01T00:00:00Z' }
  const calls = mockFetch(responseBody)
  assert.deepEqual(await api.recordRecommendationInteraction(request), responseBody)
  assert.equal(calls[0].url, '/api/feedback/interaction')
  assert.equal(calls[0].init.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].init.body), request)
})

test('history uses GET /api/feedback/history/{encoded user id}', async () => {
  const tmdbRating = { id: 22, user_id: 'browser demo/1', catalog: 'tmdb', movie_id: 'tmdb:550', rating: 5, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }
  const calls = mockFetch({ user_id: 'browser demo/1', ratings: [tmdbRating], feedback: [], interactions: [] })
  const result = await api.getFeedbackHistory('browser demo/1')
  assert.equal(calls[0].url, '/api/feedback/history/browser%20demo%2F1')
  assert.equal(calls[0].init.method, undefined)
  assert.deepEqual(result.ratings, [tmdbRating])
  assert.equal(result.ratings[0].catalog, 'tmdb')
  assert.deepEqual(result.feedback, [])
  assert.deepEqual(result.interactions, [])
})

test('recommendations use POST /api/recommendations with the backend request fields', async () => {
  const request = { mode: 'liked', algorithm: 'content', liked_movie_ids: ['m001'], top_n: 12, exclude_ids: ['m002'], exclude_rated_by_user: ['m001'] }
  const responseBody = { mode: 'liked', algorithm: 'content', source_movie_id: null, liked_movie_ids: ['m001'], user_id: null, catalog: 'local', count: 1, recommendations: [{ movie_id: 'm003', title: 'Orbit of Shadows', genres: 'Sci-Fi|Mystery', release_year: 2021, vote_average: 7.7, similarity_score: 0.42, score: null, explanation: 'Based on liked films.' }], dataset: 'sample_movies.csv' }
  const calls = mockFetch(responseBody)
  assert.deepEqual(await api.getRecommendations(request), responseBody)
  assert.equal(calls[0].url, '/api/recommendations')
  assert.equal(calls[0].init.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].init.body), request)
})

test('health check uses GET /health', async () => {
  const responseBody = { status: 'ok', app: 'RecoMind AI', version: '0.1.0', environment: 'development', database: 'ok' }
  const calls = mockFetch(responseBody)
  assert.deepEqual(await api.getApiHealth(), responseBody)
  assert.equal(calls[0].url, '/health')
  assert.equal(calls[0].init.method, undefined)
})

test('feedback service preserves HTTP status for unsupported routes', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: 'Not Found' }), { status: 404 })
  await assert.rejects(api.submitMovieRating({ user_id: 'demo', movie_id: 'm001', rating: 5 }), (error) => error.status === 404)
})
