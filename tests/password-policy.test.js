import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { requiresPasswordChange, passwordChangeError } = require('../api/src/passwordPolicy.js')
const { hashPassword } = require('../api/src/security.js')

test('initial password requires change; chosen passwords do not; reset is detected', async () => {
  const record = { phone_number: '+905001234567', password_hash: await hashPassword('234567') }
  assert.equal(await requiresPasswordChange(record), true)
  record.password_hash = await hashPassword('918273')
  assert.equal(await requiresPasswordChange(record), false)
  record.password_hash = await hashPassword('234567')
  assert.equal(await requiresPasswordChange(record), true)
  assert.equal(await requiresPasswordChange({}), false)
})

test('session token carries mustChangePassword for own sessions, omits it for delegated ones', () => {
  process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'test-secret-please-ignore'
  const { createSessionToken, verifySessionToken } = require('../api/src/security.js')
  const base = { id: 'u1', email: 'u1@example.com', fullName: 'U One', role: 'ebeveyn' }

  assert.equal(verifySessionToken(createSessionToken({ ...base, mustChangePassword: true })).mustChangePassword, true)
  assert.equal(verifySessionToken(createSessionToken({ ...base, mustChangePassword: false })).mustChangePassword, false)
  assert.equal(verifySessionToken(createSessionToken(base)).mustChangePassword, false)
  // Delegated sessions never carry the claim (the gate exempts them by acting id anyway).
  const delegated = verifySessionToken(createSessionToken({ ...base, mustChangePassword: true }, { actingParentId: 'p1', actingParentName: 'P' }))
  assert.equal('mustChangePassword' in delegated, false)
})

test('new password must be digits-only, cannot equal current/default, min 6 digits', () => {
  assert.ok(passwordChangeError('234567', '234567', '+905001234567'))
  assert.ok(passwordChangeError('918273', '234567', '+905001234567'))
  assert.ok(passwordChangeError('918273', '12345', '+905001234567'))
  assert.ok(passwordChangeError('918273', 'MyNewPassword7', '+905001234567'))
  assert.ok(passwordChangeError('918273', 'abc123', '+905001234567'))
  assert.equal(passwordChangeError('234567', '918273', '+905001234567'), null)
})

test('API gate blocks temporary credentials, preserves recovery and delegated access, fails closed', async () => {
  const dbPath = require.resolve('../api/src/db.js')
  const securityPath = require.resolve('../api/src/security.js')
  const oldDb = require.cache[dbPath]
  const oldSecurity = require.cache[securityPath]
  let session = { sub: 'parent' }
  let record = { phone_number: '+905001234567', password_hash: await hashPassword('234567') }
  let failDb = false
  let dbCalls = 0
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { sql: { UniqueIdentifier: 'id' }, withRequest: async () => { dbCalls += 1; if (failDb) throw new Error('offline'); return { query: async () => ({ recordset: [record] }) } } } }
  require.cache[securityPath] = { id: securityPath, filename: securityPath, loaded: true, exports: { readSessionToken: () => 'token', verifySessionToken: () => session, isSessionError: () => false } }
  try {
    const { withPasswordGate } = require('../api/src/passwordGate.js')
    const handler = async () => ({ status: 200 })
    const guarded = withPasswordGate('parent/students', handler)
    const context = { error: () => {} }
    // Legacy token (no claim) → live DB check, temp password blocked.
    assert.equal((await guarded({}, context)).status, 403)
    for (const route of ['auth/me', 'auth/change-password', 'auth/logout', 'auth/consent', 'payments/iyzico/callback']) assert.equal(withPasswordGate(route, handler), handler)
    session = { sub: 'child', actingParentId: 'parent' }
    assert.equal((await guarded({}, context)).status, 200)
    session = { sub: 'parent' }
    record = { ...record, password_hash: await hashPassword('918273') }
    assert.equal((await guarded({}, context)).status, 200)
    failDb = true
    assert.equal((await guarded({}, context)).status, 503)
    // Modern token carries the decision as a claim → no DB round-trip either way.
    failDb = false
    dbCalls = 0
    session = { sub: 'parent', mustChangePassword: true }
    assert.equal((await guarded({}, context)).status, 403)
    session = { sub: 'parent', mustChangePassword: false }
    assert.equal((await guarded({}, context)).status, 200)
    assert.equal(dbCalls, 0)
  } finally {
    if (oldDb) require.cache[dbPath] = oldDb; else delete require.cache[dbPath]
    require.cache[securityPath] = oldSecurity
  }
})
