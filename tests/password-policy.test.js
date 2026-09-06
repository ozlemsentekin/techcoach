import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { requiresPasswordChange, passwordChangeError } = require('../api/src/passwordPolicy.js')
const { hashPassword } = require('../api/src/security.js')

test('initial password requires change; chosen passwords do not; reset is detected', async () => {
  const record = { phone_number: '+905001234567', password_hash: await hashPassword('234567') }
  assert.equal(await requiresPasswordChange(record), true)
  record.password_hash = await hashPassword('MyNewPassword7')
  assert.equal(await requiresPasswordChange(record), false)
  record.password_hash = await hashPassword('234567')
  assert.equal(await requiresPasswordChange(record), true)
  assert.equal(await requiresPasswordChange({}), false)
})

test('new password cannot equal current/default or exceed bcrypt byte limit', () => {
  assert.ok(passwordChangeError('234567', '234567', '+905001234567'))
  assert.ok(passwordChangeError('oldpassword', '234567', '+905001234567'))
  assert.ok(passwordChangeError('oldpassword', 'ab', '+905001234567'))
  assert.ok(passwordChangeError('oldpassword', 'ş'.repeat(40), '+905001234567'))
  assert.equal(passwordChangeError('234567', 'MyNewPassword7', '+905001234567'), null)
})

test('API gate blocks temporary credentials, preserves recovery and delegated access, fails closed', async () => {
  const dbPath = require.resolve('../api/src/db.js')
  const securityPath = require.resolve('../api/src/security.js')
  const oldDb = require.cache[dbPath]
  const oldSecurity = require.cache[securityPath]
  let session = { sub: 'parent' }
  let record = { phone_number: '+905001234567', password_hash: await hashPassword('234567') }
  let failDb = false
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { sql: { UniqueIdentifier: 'id' }, withRequest: async () => { if (failDb) throw new Error('offline'); return { query: async () => ({ recordset: [record] }) } } } }
  require.cache[securityPath] = { id: securityPath, filename: securityPath, loaded: true, exports: { readSessionToken: () => 'token', verifySessionToken: () => session, isSessionError: () => false } }
  try {
    const { withPasswordGate } = require('../api/src/passwordGate.js')
    const handler = async () => ({ status: 200 })
    const guarded = withPasswordGate('parent/students', handler)
    const context = { error: () => {} }
    assert.equal((await guarded({}, context)).status, 403)
    for (const route of ['auth/me', 'auth/change-password', 'auth/logout', 'auth/consent', 'payments/iyzico/callback']) assert.equal(withPasswordGate(route, handler), handler)
    session = { sub: 'child', actingParentId: 'parent' }
    assert.equal((await guarded({}, context)).status, 200)
    session = { sub: 'parent' }
    record = { ...record, password_hash: await hashPassword('MyNewPassword7') }
    assert.equal((await guarded({}, context)).status, 200)
    failDb = true
    assert.equal((await guarded({}, context)).status, 503)
  } finally {
    if (oldDb) require.cache[dbPath] = oldDb; else delete require.cache[dbPath]
    require.cache[securityPath] = oldSecurity
  }
})
