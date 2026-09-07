import test from 'node:test'
import assert from 'node:assert/strict'
import { authRequest, cachedGet, invalidateCache } from '../src/services/authClient.js'

test('GET cache shares requests, isolates students and refreshes after writes', async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  globalThis.window = globalThis
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return new Response(JSON.stringify({ version: calls }), { headers: { 'Content-Type': 'application/json' } })
  }
  try {
    invalidateCache()
    const first = cachedGet('/api/panel/tasks?studentId=a')
    assert.equal(cachedGet('/api/panel/tasks?studentId=a'), first)
    await first
    await cachedGet('/api/panel/tasks?studentId=a')
    assert.equal(calls, 1)
    await cachedGet('/api/panel/tasks?studentId=b')
    assert.equal(calls, 2)
    await authRequest('/api/panel/tasks/1', { method: 'PATCH', body: '{}' })
    assert.equal((await cachedGet('/api/panel/tasks?studentId=a')).version, 4)
  } finally {
    invalidateCache()
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
  }
})

test('an invalidated failing request cannot remove its replacement', async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  globalThis.window = globalThis
  let rejectOld
  globalThis.fetch = () => new Promise((_, reject) => { rejectOld = reject })
  try {
    invalidateCache()
    const old = cachedGet('/data')
    const rejected = assert.rejects(old)
    invalidateCache()
    globalThis.fetch = async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } })
    const replacement = cachedGet('/data')
    await replacement
    rejectOld(new Error('old request failed'))
    await rejected
    assert.equal(cachedGet('/data'), replacement)
  } finally {
    invalidateCache()
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
  }
})

test('expired entries refresh and navigation does not retain unlimited responses', async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  globalThis.window = globalThis
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return new Response('{}', { headers: { 'Content-Type': 'application/json' } })
  }
  try {
    invalidateCache()
    await cachedGet('/expired', { ttlMs: 0 })
    await cachedGet('/expired', { ttlMs: 0 })
    assert.equal(calls, 2)
    const first = cachedGet('/page/0')
    await first
    for (let i = 1; i <= 100; i += 1) await cachedGet(`/page/${i}`)
    const next = cachedGet('/page/0')
    assert.notEqual(next, first)
    await next
    assert.equal(calls, 104)
  } finally {
    invalidateCache()
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
  }
})
