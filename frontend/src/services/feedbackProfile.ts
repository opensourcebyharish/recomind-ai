const storageKey = 'recomind-browser-demo-user-id'

function createDemoId(): string {
  const random = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `browser-demo-${random}`
}

/** A persistent browser-local demo identifier. The backend does not authenticate it. */
export function getBrowserDemoUserId(): string {
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored) return stored
    const id = createDemoId()
    window.localStorage.setItem(storageKey, id)
    return id
  } catch {
    return `${createDemoId()}-session`
  }
}
