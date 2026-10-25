import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const testRequire = createRequire(import.meta.url)
const moduleLoader = testRequire('node:module')
const originalLoad = moduleLoader._load
const sourceFile = path.resolve('src/components/FeedbackPanel.tsx')
moduleLoader._extensions['.tsx'] = (module, filename) => {
  const source = testRequire('node:fs').readFileSync(filename, 'utf8')
  const js = ts.transpileModule(source, { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  module._compile(js, filename)
}
moduleLoader._load = function (request, parent, isMain) {
  if (parent?.filename === sourceFile && request === 'framer-motion') return { AnimatePresence: ({ children }) => children, motion: new Proxy({}, { get: (_target, tag) => String(tag) }) }
  if (parent?.filename === sourceFile && request === 'lucide-react') return new Proxy({}, { get: (_target, name) => (props) => React.createElement('svg', { ...props, 'data-icon': String(name) }) })
  return originalLoad.call(this, request, parent, isMain)
}

const { FeedbackPanel } = testRequire(sourceFile)
const render = (props) => renderToStaticMarkup(React.createElement(FeedbackPanel, props))
const common = {
  movieId: 'tmdb:550', rating: { id: 5, user_id: 'demo-user', catalog: 'tmdb', movie_id: 'tmdb:550', rating: 4, created_at: '', updated_at: '' },
  feedback: null, busy: false, message: '', error: false, onRate() {}, onFeedback() {}, canRefresh: false, refreshBusy: false, refreshMessage: '', refreshError: false, onRefresh() {},
}

test('TMDB details display saved 1â€“5 star controls without local reactions or recommendation refresh', () => {
  const markup = render({ ...common, canReact: false, showRefresh: false })
  for (let rating = 1; rating <= 5; rating += 1) assert.match(markup, new RegExp(`aria-label="Rate ${rating} out of 5"`))
  assert.match(markup, /aria-pressed="true"/)
  assert.match(markup, /TMDB ratings are saved to Activity/)
  assert.doesNotMatch(markup, /Like this movie|Dislike this movie|Refresh recommendations/)
})

test('local details retain reactions and recommendation refresh controls', () => {
  const markup = render({ ...common, movieId: 'm001', rating: { ...common.rating, catalog: 'local', movie_id: 'm001' }, canReact: true, showRefresh: true })
  assert.match(markup, /aria-label="Like or dislike this movie"/)
  assert.match(markup, />Like</)
  assert.match(markup, />Dislike</)
  assert.match(markup, /Refresh recommendations/)
})

test('rating submissions expose busy, saved, and error feedback states', () => {
  const busy = render({ ...common, canReact: false, showRefresh: false, busy: true, message: '' })
  const success = render({ ...common, canReact: false, showRefresh: false, message: 'Rating saved. You can change it any time.' })
  const failure = render({ ...common, canReact: false, showRefresh: false, error: true, message: 'Could not save your rating.' })
  assert.match(busy, /role="status"/)
  assert.match(success, /role="status"/)
  assert.match(success, /Rating saved/)
  assert.match(failure, /role="alert"/)
  assert.match(failure, /Could not save your rating/)
})

test.after(() => { moduleLoader._load = originalLoad })
