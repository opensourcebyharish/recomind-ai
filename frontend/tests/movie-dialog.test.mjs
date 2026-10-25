import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { createRequire } from 'node:module'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const testRequire = createRequire(import.meta.url)
const moduleLoader = testRequire('node:module')
const originalLoad = moduleLoader._load
const sourceFile = path.resolve('src/components/MovieDialog.tsx')
moduleLoader._extensions['.tsx'] = (module, filename) => {
  const source = testRequire('node:fs').readFileSync(filename, 'utf8')
  const js = ts.transpileModule(source, { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  module._compile(js, filename)
}
moduleLoader._load = function (request, parent, isMain) {
  if (parent?.filename === sourceFile && request === 'framer-motion') return { AnimatePresence: ({ children }) => children, motion: new Proxy({}, { get: (_target, tag) => String(tag) }) }
  if (parent?.filename === sourceFile && request === 'lucide-react') return new Proxy({}, { get: (_target, name) => (props) => React.createElement('svg', { ...props, 'data-icon': String(name) }) })
  if (parent?.filename === sourceFile && request === './FeedbackPanel') return { FeedbackPanel: () => null }
  if (parent?.filename === sourceFile && request === './MovieMedia') return { MovieMedia: () => null }
  return originalLoad.call(this, request, parent, isMain)
}

const { MovieDialog, isDialogEscapeKey, isDialogBackdropTarget, lockDialogPageScroll } = testRequire(sourceFile)

test('movie details include a labeled close button in the sticky header', () => {
  const props = {
    movie: { movie_id: 'm001', title: 'Test Film', source: 'local', release_year: 2024, genres: 'Drama', vote_average: 7.5, poster_url: null, backdrop_url: null },
    favorite: false, onClose() {}, onFavorite() {}, watchStatus: null, onWatchlist() {},
    ratingCompatible: false, feedbackCompatible: false, theme: 'violet', rating: null, feedback: null,
    feedbackBusy: false, feedbackMessage: '', feedbackError: false, onRate() {}, onFeedback() {},
    canRefresh: false, refreshBusy: false, refreshMessage: '', refreshError: false, onRefresh() {},
  }
  const markup = renderToStaticMarkup(React.createElement(MovieDialog, props))
  assert.match(markup, /class="dialog-sticky-header"[^>]*><button[^>]*aria-label="Close movie details"/)
  assert.match(markup, /role="dialog"/)
})

test('Escape is the dialog dismissal key', () => {
  assert.equal(isDialogEscapeKey('Escape'), true)
  assert.equal(isDialogEscapeKey('Enter'), false)
})

test('only a backdrop target dismisses the dialog', () => {
  const backdrop = {}
  const dialog = {}
  assert.equal(isDialogBackdropTarget(backdrop, backdrop), true)
  assert.equal(isDialogBackdropTarget(dialog, backdrop), false)
})

test('page scrolling is locked while open and prior overflow styles are restored on cleanup', () => {
  const body = { style: { overflow: 'clip' } }
  const root = { style: { overflow: 'auto' } }
  const restore = lockDialogPageScroll(body, root)
  assert.equal(body.style.overflow, 'hidden')
  assert.equal(root.style.overflow, 'hidden')
  restore()
  assert.equal(body.style.overflow, 'clip')
  assert.equal(root.style.overflow, 'auto')
})

after(() => { moduleLoader._load = originalLoad })
