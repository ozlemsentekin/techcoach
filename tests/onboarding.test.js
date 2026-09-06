import test from 'node:test'
import assert from 'node:assert/strict'
import { positionTourCard } from '../src/panels/shared/tour/tourPosition.js'
import { hasSeenWelcome, saveOnboardingState } from '../src/panels/parent/onboarding/onboardingStorage.js'

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
  for (const top of [20, Math.floor(viewport.height / 2), viewport.height - 80]) {
    test(`tour stays in ${viewport.width}x${viewport.height} without covering target at ${top}`, () => {
      const target = { left: 16, right: 280, width: 264, top, bottom: top + 44 }
      const position = positionTourCard(target, viewport, { width: 352, height: 270 })
      const height = Math.min(270, position.maxHeight)
      assert.ok(position.left >= 12)
      assert.ok(position.left + position.width <= viewport.width - 12)
      assert.ok(position.top >= 12)
      assert.ok(position.top + height <= viewport.height - 12)
      assert.ok(position.top >= target.bottom || position.top + height <= target.top)
    })
  }
}

test('preferences are per parent, honor the legacy key, and tolerate denied storage', () => {
  const data = new Map()
  globalThis.window = { localStorage: { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) } }
  assert.equal(hasSeenWelcome(null), true)
  assert.equal(hasSeenWelcome('new-parent'), false)
  saveOnboardingState('new-parent', 'skipped')
  assert.equal(hasSeenWelcome('new-parent'), true)
  assert.equal(hasSeenWelcome('other-parent'), false)
  data.set('techcoach_demo:v1:parentWelcomeSeen', JSON.stringify({ legacy: true }))
  assert.equal(hasSeenWelcome('legacy'), true)
  window.localStorage.setItem = () => { throw new Error('Storage denied') }
  assert.doesNotThrow(() => saveOnboardingState('private-parent', 'deferred'))
  assert.equal(hasSeenWelcome('private-parent'), true)
  delete globalThis.window
})
