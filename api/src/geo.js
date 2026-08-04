const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const { isSessionError, readSessionToken, verifySessionToken } = require('./security')

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isGuid(value) {
  return typeof value === 'string' && GUID_PATTERN.test(value.trim())
}

function requireSession(request) {
  const token = readSessionToken(request)
  if (!token) {
    return { error: json(401, { error: 'Oturum bulunamadı.' }) }
  }
  verifySessionToken(token)
  return {}
}

function sanitizeProvince(record) {
  return {
    id: record.id,
    name: record.name,
    plateCode: record.plate_code,
  }
}

function sanitizeDistrict(record) {
  return {
    id: record.id,
    provinceId: record.province_id,
    name: record.name,
  }
}

function sanitizeSchool(record) {
  return {
    id: record.id,
    provinceId: record.province_id,
    districtId: record.district_id,
    name: record.name,
    type: record.school_type,
  }
}

async function listProvincesHandler(request) {
  try {
    const { error } = requireSession(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT id, name, plate_code FROM dbo.Provinces ORDER BY name ASC;
    `)

    return json(200, { provinces: result.recordset.map(sanitizeProvince) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listProvincesHandler failed', error)
    return json(500, { error: 'İller yüklenemedi.' })
  }
}

async function listDistrictsHandler(request) {
  try {
    const { error } = requireSession(request)
    if (error) {
      return error
    }

    const provinceId = request.query.get('provinceId')
    if (!isGuid(provinceId)) {
      return json(400, { error: 'Geçerli bir il seçin.' })
    }

    const requestDb = await withRequest({
      provinceId: { type: sql.UniqueIdentifier, value: provinceId },
    })
    const result = await requestDb.query(`
      SELECT id, province_id, name FROM dbo.Districts WHERE province_id = @provinceId ORDER BY name ASC;
    `)

    return json(200, { districts: result.recordset.map(sanitizeDistrict) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listDistrictsHandler failed', error)
    return json(500, { error: 'İlçeler yüklenemedi.' })
  }
}

async function listSchoolsHandler(request) {
  try {
    const { error } = requireSession(request)
    if (error) {
      return error
    }

    const districtId = request.query.get('districtId')
    if (!isGuid(districtId)) {
      return json(400, { error: 'Geçerli bir ilçe seçin.' })
    }

    const search = request.query.get('search')?.trim() || null

    const requestDb = await withRequest({
      districtId: { type: sql.UniqueIdentifier, value: districtId },
      search: { type: sql.NVarChar(200), value: search ? `%${search}%` : null },
    })
    const result = await requestDb.query(`
      SELECT TOP 50 id, province_id, district_id, name, school_type
      FROM dbo.Schools
      WHERE district_id = @districtId AND is_active = 1
        AND (@search IS NULL OR name LIKE @search)
      ORDER BY name ASC;
    `)

    return json(200, { schools: result.recordset.map(sanitizeSchool) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listSchoolsHandler failed', error)
    return json(500, { error: 'Okullar yüklenemedi.' })
  }
}

module.exports = {
  listProvincesHandler,
  listDistrictsHandler,
  listSchoolsHandler,
}
