import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

async function importTypeScript(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

const { buildFeedbackRecommendationRequest } = await importTypeScript('../src/services/feedbackPersonalization.ts')
const { getBrowserDemoUserId } = await importTypeScript('../src/services/feedbackProfile.ts')

const rating = (movie_id, value, catalog = 'local') => ({ id: 1, user_id: 'browser-demo-1', catalog, movie_id, rating: value, created_at: '', updated_at: '' })
const reaction = (movie_id, feedback_type) => ({ id: 1, user_id: 'browser-demo-1', movie_id, feedback_type, created_at: '', updated_at: '' })

test('recommendation refresh uses likes and 4-5 ratings as seeds and dislike/1-2 ratings as exclusions', () => {
  const request = buildFeedbackRecommendationRequest({
    feedback: { m001: reaction('m001', 'like'), m002: reaction('m002', 'dislike') },
    ratings: { m003: rating('m003', 5), m004: rating('m004', 1), m005: rating('m005', 3) },
    tasteGenres: ['Sci-Fi'], minimumRating: 7.5, excludeFavorites: true, favorites: ['m006'], localMovieIds: ['m001','m002','m003','m004','m005','m006'],
  })
  assert.deepEqual(request, {
    mode: 'liked', algorithm: 'content', liked_movie_ids: ['m001', 'm003'], top_n: 12,
    genre_preference: ['Sci-Fi'], min_vote_average: 7.5,
    exclude_ids: ['m002', 'm004', 'm006'],
    exclude_rated_by_user: ['m003', 'm004', 'm005'],
  })
})

test('neutral and negative-only feedback does not create a fake positive seed', () => {
  const request = buildFeedbackRecommendationRequest({
    feedback: { m001: reaction('m001', 'dislike') }, ratings: { m002: rating('m002', 3) },
    tasteGenres: [], minimumRating: 0, excludeFavorites: false, favorites: [], localMovieIds: ['m001','m002'],
  })
  assert.equal(request, null)
})

test('negative feedback wins if the same title also has a positive rating', () => {
  const request = buildFeedbackRecommendationRequest({
    feedback: { m001: reaction('m001', 'dislike') }, ratings: { m001: rating('m001', 5) },
    tasteGenres: [], minimumRating: 0, excludeFavorites: false, favorites: [], localMovieIds: ['m001'],
  })
  assert.equal(request, null)
})

test('recommendation requests exclude TMDB and MovieLens IDs from every movie-ID field', () => {
  const request = buildFeedbackRecommendationRequest({
    feedback: { m001: reaction('m001', 'like'), 'tmdb:42': reaction('tmdb:42', 'like'), '9001': reaction('9001', 'dislike') },
    ratings: { 'tmdb:43': rating('tmdb:43', 1), '9002': rating('9002', 4) },
    tasteGenres: [], minimumRating: 0, excludeFavorites: true,
    favorites: ['tmdb:44', '9003'], localMovieIds: ['m001', 'm002'],
  })
  assert.deepEqual(request?.liked_movie_ids, ['m001'])
  assert.deepEqual(request?.exclude_ids, [])
  assert.deepEqual(request?.exclude_rated_by_user, [])
})

test('TMDB ratings remain saved but never become local recommendation seeds or exclusions', () => {
  const request = buildFeedbackRecommendationRequest({
    feedback: { m001: reaction('m001', 'like') },
    ratings: { m002: rating('m002', 5), 'tmdb:550': rating('tmdb:550', 1, 'tmdb') },
    tasteGenres: [], minimumRating: 0, excludeFavorites: false, favorites: [], localMovieIds: ['m001', 'm002'],
  })
  assert.deepEqual(request?.liked_movie_ids, ['m001', 'm002'])
  assert.deepEqual(request?.exclude_ids, [])
  assert.deepEqual(request?.exclude_rated_by_user, ['m002'])
  assert.ok(!JSON.stringify(request).includes('tmdb:550'))
})

test('browser demo identifier is stable across page reloads using shared local storage', () => {
  const values = new Map()
  globalThis.window = {
    localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    crypto: { randomUUID: () => 'stable-test-id' },
  }
  const firstLoadId = getBrowserDemoUserId()
  const secondLoadId = getBrowserDemoUserId()
  assert.equal(firstLoadId, 'browser-demo-stable-test-id')
  assert.equal(secondLoadId, firstLoadId)
})

test('browser demo identifier remains available when storage or randomUUID is unavailable', () => {
  globalThis.window = {
    localStorage: { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } },
    crypto: {},
  }
  assert.match(getBrowserDemoUserId(), /^browser-demo-.*-session$/)
})
