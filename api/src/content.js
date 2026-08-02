const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const { requireAdmin } = require('./admin')
const { isSessionError, readSessionToken, verifySessionToken } = require('./security')

const MOTIVATION_CATEGORIES = [
  'general',
  'low_energy',
  'high_stress',
  'start_easy',
  'task_started',
  'partial_completion',
  'strong_progress',
  'completed_day',
]

function sanitizeMotivationMessage(record) {
  return {
    id: record.id,
    category: record.category,
    title: record.title,
    body: record.body,
    isActive: Boolean(record.is_active),
    createdAt: record.created_at,
  }
}

function sanitizeGreetingRule(record) {
  return {
    id: record.id,
    label: record.label,
    endHour: record.end_hour,
    createdAt: record.created_at,
  }
}

// ---- Motivasyon mesajı havuzu (admin) ----

async function listMotivationMessagesHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT id, category, title, body, is_active, created_at
      FROM dbo.MotivationMessagePool
      ORDER BY category ASC, created_at ASC;
    `)

    return json(200, { messages: result.recordset.map(sanitizeMotivationMessage) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listMotivationMessagesHandler failed', error)
    return json(500, { error: 'Motivasyon mesajları yüklenemedi.' })
  }
}

async function createMotivationMessageHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const payload = await request.json().catch(() => null)
    const category = payload?.category
    const title = payload?.title?.trim()
    const body = payload?.body?.trim()

    if (!MOTIVATION_CATEGORIES.includes(category)) {
      return json(400, { error: 'Geçerli bir kategori seçilmeli.' })
    }
    if (!title || title.length < 2) {
      return json(400, { error: 'Başlık en az 2 karakter olmalı.' })
    }
    if (!body || body.length < 2) {
      return json(400, { error: 'Mesaj metni en az 2 karakter olmalı.' })
    }

    const requestDb = await withRequest({
      category: { type: sql.NVarChar(50), value: category },
      title: { type: sql.NVarChar(200), value: title },
      body: { type: sql.NVarChar(500), value: body },
    })
    const result = await requestDb.query(`
      INSERT INTO dbo.MotivationMessagePool (category, title, body)
      OUTPUT inserted.id, inserted.category, inserted.title, inserted.body, inserted.is_active, inserted.created_at
      VALUES (@category, @title, @body);
    `)

    return json(201, { message: sanitizeMotivationMessage(result.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('createMotivationMessageHandler failed', error)
    return json(500, { error: 'Mesaj oluşturulamadı.' })
  }
}

async function updateMotivationMessageHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const messageId = request.params.messageId
    const payload = await request.json().catch(() => null)
    const category = payload?.category
    const title = payload?.title?.trim()
    const body = payload?.body?.trim()
    const isActive = Boolean(payload?.isActive)

    if (!MOTIVATION_CATEGORIES.includes(category)) {
      return json(400, { error: 'Geçerli bir kategori seçilmeli.' })
    }
    if (!title || title.length < 2) {
      return json(400, { error: 'Başlık en az 2 karakter olmalı.' })
    }
    if (!body || body.length < 2) {
      return json(400, { error: 'Mesaj metni en az 2 karakter olmalı.' })
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: messageId },
      category: { type: sql.NVarChar(50), value: category },
      title: { type: sql.NVarChar(200), value: title },
      body: { type: sql.NVarChar(500), value: body },
      isActive: { type: sql.Bit, value: isActive },
    })
    const result = await requestDb.query(`
      UPDATE dbo.MotivationMessagePool
      SET category = @category, title = @title, body = @body, is_active = @isActive
      OUTPUT inserted.id, inserted.category, inserted.title, inserted.body, inserted.is_active, inserted.created_at
      WHERE id = @id;
    `)

    if (result.recordset.length === 0) {
      return json(404, { error: 'Mesaj bulunamadı.' })
    }

    return json(200, { message: sanitizeMotivationMessage(result.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('updateMotivationMessageHandler failed', error)
    return json(500, { error: 'Mesaj güncellenemedi.' })
  }
}

// ---- Motivasyon mesajı havuzu (panel, salt-okunur) ----

async function listMotivationMessagePoolForPanelHandler(request) {
  try {
    const token = readSessionToken(request)
    if (!token) {
      return json(401, { error: 'Oturum bulunamadı.' })
    }
    verifySessionToken(token)

    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT id, category, title, body, is_active, created_at
      FROM dbo.MotivationMessagePool
      WHERE is_active = 1
      ORDER BY category ASC, created_at ASC;
    `)

    return json(200, { messages: result.recordset.map(sanitizeMotivationMessage) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listMotivationMessagePoolForPanelHandler failed', error)
    return json(500, { error: 'Motivasyon mesajları yüklenemedi.' })
  }
}

// ---- Selamlama kuralları (admin) ----

async function listGreetingRulesHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT id, label, end_hour, created_at FROM dbo.GreetingRules ORDER BY end_hour ASC;
    `)

    return json(200, { rules: result.recordset.map(sanitizeGreetingRule) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listGreetingRulesHandler failed', error)
    return json(500, { error: 'Selamlama kuralları yüklenemedi.' })
  }
}

async function createGreetingRuleHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const payload = await request.json().catch(() => null)
    const label = payload?.label?.trim()
    const endHour = Number(payload?.endHour)

    if (!label || label.length < 2) {
      return json(400, { error: 'Etiket en az 2 karakter olmalı.' })
    }
    if (!Number.isInteger(endHour) || endHour < 1 || endHour > 24) {
      return json(400, { error: 'Bitiş saati 1 ile 24 arasında bir tam sayı olmalı.' })
    }

    const requestDb = await withRequest({
      label: { type: sql.NVarChar(50), value: label },
      endHour: { type: sql.Int, value: endHour },
    })
    const result = await requestDb.query(`
      INSERT INTO dbo.GreetingRules (label, end_hour)
      OUTPUT inserted.id, inserted.label, inserted.end_hour, inserted.created_at
      VALUES (@label, @endHour);
    `)

    return json(201, { rule: sanitizeGreetingRule(result.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('createGreetingRuleHandler failed', error)
    return json(500, { error: 'Kural oluşturulamadı.' })
  }
}

async function updateGreetingRuleHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const ruleId = request.params.ruleId
    const payload = await request.json().catch(() => null)
    const label = payload?.label?.trim()
    const endHour = Number(payload?.endHour)

    if (!label || label.length < 2) {
      return json(400, { error: 'Etiket en az 2 karakter olmalı.' })
    }
    if (!Number.isInteger(endHour) || endHour < 1 || endHour > 24) {
      return json(400, { error: 'Bitiş saati 1 ile 24 arasında bir tam sayı olmalı.' })
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: ruleId },
      label: { type: sql.NVarChar(50), value: label },
      endHour: { type: sql.Int, value: endHour },
    })
    const result = await requestDb.query(`
      UPDATE dbo.GreetingRules
      SET label = @label, end_hour = @endHour
      OUTPUT inserted.id, inserted.label, inserted.end_hour, inserted.created_at
      WHERE id = @id;
    `)

    if (result.recordset.length === 0) {
      return json(404, { error: 'Kural bulunamadı.' })
    }

    return json(200, { rule: sanitizeGreetingRule(result.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('updateGreetingRuleHandler failed', error)
    return json(500, { error: 'Kural güncellenemedi.' })
  }
}

async function deleteGreetingRuleHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const ruleId = request.params.ruleId

    const countDb = await withRequest({})
    const countResult = await countDb.query(`SELECT COUNT(*) AS total FROM dbo.GreetingRules;`)
    if (countResult.recordset[0].total <= 1) {
      return json(400, { error: 'Son kalan selamlama kuralı silinemez.' })
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: ruleId },
    })
    const result = await requestDb.query(`DELETE FROM dbo.GreetingRules WHERE id = @id;`)

    if (!result.rowsAffected[0]) {
      return json(404, { error: 'Kural bulunamadı.' })
    }

    return json(200, { success: true })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('deleteGreetingRuleHandler failed', error)
    return json(500, { error: 'Kural silinemedi.' })
  }
}

// ---- Selamlama kuralları (panel, salt-okunur) ----

async function listGreetingRulesForPanelHandler(request) {
  try {
    const token = readSessionToken(request)
    if (!token) {
      return json(401, { error: 'Oturum bulunamadı.' })
    }
    verifySessionToken(token)

    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT id, label, end_hour, created_at FROM dbo.GreetingRules ORDER BY end_hour ASC;
    `)

    return json(200, { rules: result.recordset.map(sanitizeGreetingRule) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listGreetingRulesForPanelHandler failed', error)
    return json(500, { error: 'Selamlama kuralları yüklenemedi.' })
  }
}

module.exports = {
  listMotivationMessagesHandler,
  createMotivationMessageHandler,
  updateMotivationMessageHandler,
  listMotivationMessagePoolForPanelHandler,
  listGreetingRulesHandler,
  createGreetingRuleHandler,
  updateGreetingRuleHandler,
  deleteGreetingRuleHandler,
  listGreetingRulesForPanelHandler,
}
