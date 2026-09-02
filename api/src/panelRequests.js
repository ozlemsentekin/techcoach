const { sql, withRequest, withTransaction } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const { isSessionError, readSessionToken, verifySessionToken } = require('./security')
const { requireAdmin } = require('./admin')

// Panel talep sistemi (bkz. api/sql/create-panel-requests-schema.sql). Şimdilik tek tür:
// 'kitap-ekleme'. Veli/öğretmen/öğrenci bir kitabın fotoğraflarını yükleyip kütüphaneye
// eklenmesini talep eder; admin "Kitap Talepleri" ekranından tamamlandı/iptal işaretler.

const REQUEST_TYPES = ['kitap-ekleme']
const REQUEST_STATUSES = ['beklemede', 'tamamlandi', 'iptal']
const ADMIN_STATUSES = ['tamamlandi', 'iptal']

// İstemci fotoğrafları göndermeden önce uzun kenarı ~1600px'e küçültüp JPEG'e çeviriyor
// (bkz. src/utils/photoDownscale.js). Yine de sunucuda katı sınır uyguluyoruz.
const MAX_PHOTO_MB = 3
const MAX_PHOTO_LENGTH = Math.ceil((MAX_PHOTO_MB * 1024 * 1024 * 4) / 3)
const MAX_PHOTOS_PER_SECTION = 15
const PHOTO_DATA_URL_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i

// İstemci anahtarı -> DB `section` değeri.
const PHOTO_SECTIONS = {
  kapak: 'kapak',
  icindekiler: 'icindekiler',
  cevapAnahtari: 'cevap-anahtari',
}

async function requirePanelUser(request) {
  const token = readSessionToken(request)
  if (!token) {
    return { error: json(401, { error: 'Oturum bulunamadı.' }) }
  }

  const session = verifySessionToken(token)
  const userId = session.actingParentId || session.sub

  const requestDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: userId } })
  const result = await requestDb.query(`
    SELECT TOP 1 id, full_name, role, is_admin, aydinlatma_accepted_at, kvkk_accepted_at
    FROM dbo.Users WHERE id = @id;
  `)
  const record = result.recordset[0]
  if (!record) {
    return { error: json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders()) }
  }

  const role = session.actingParentId ? 'ebeveyn' : record.role
  if (role !== 'ogretmen' && (!record.aydinlatma_accepted_at || !record.kvkk_accepted_at)) {
    return {
      error: json(403, {
        error: 'Devam etmek için KVKK ve aydınlatma metnini onaylamalısınız.',
        code: 'CONSENT_REQUIRED',
      }),
    }
  }

  return {
    userId: record.id,
    role,
    name: record.full_name,
    isAdmin: Boolean(record.is_admin),
  }
}

function parsePayload(payloadJson) {
  if (!payloadJson) return {}
  try {
    const parsed = JSON.parse(payloadJson)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function sanitizeRequestRow(row) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    book: parsePayload(row.payload_json),
    adminNote: row.admin_note || null,
    photoCounts: {
      kapak: row.kapak_count || 0,
      icindekiler: row.icindekiler_count || 0,
      cevapAnahtari: row.cevap_anahtari_count || 0,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at || null,
  }
}

const PHOTO_COUNT_SELECT = `
  (SELECT COUNT(*) FROM dbo.PanelRequestPhotos p WHERE p.request_id = r.id AND p.section = 'kapak') AS kapak_count,
  (SELECT COUNT(*) FROM dbo.PanelRequestPhotos p WHERE p.request_id = r.id AND p.section = 'icindekiler') AS icindekiler_count,
  (SELECT COUNT(*) FROM dbo.PanelRequestPhotos p WHERE p.request_id = r.id AND p.section = 'cevap-anahtari') AS cevap_anahtari_count
`

function validatePhotoList(list, label, { min }) {
  if (!Array.isArray(list)) {
    return min > 0 ? `${label} fotoğrafı ekleyin.` : null
  }
  if (list.length < min) {
    return `${label} için en az ${min} fotoğraf ekleyin.`
  }
  if (list.length > MAX_PHOTOS_PER_SECTION) {
    return `${label} için en fazla ${MAX_PHOTOS_PER_SECTION} fotoğraf ekleyebilirsiniz.`
  }
  for (const photo of list) {
    if (typeof photo !== 'string' || !PHOTO_DATA_URL_PATTERN.test(photo)) {
      return `${label} fotoğraflarından biri geçersiz. JPG, PNG veya WEBP yükleyin.`
    }
    if (photo.length > MAX_PHOTO_LENGTH) {
      return `${label} fotoğraflarından biri çok büyük (en fazla ${MAX_PHOTO_MB} MB).`
    }
  }
  return null
}

function normalizePayload(book) {
  if (!book || typeof book !== 'object') return null
  const clean = (value, max) =>
    typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined

  const payload = {
    bookName: clean(book.bookName, 200),
    publisherName: clean(book.publisherName, 200),
    subjectId: clean(book.subjectId, 50),
    grade: clean(book.grade, 10),
    note: clean(book.note, 1000),
  }
  const hasAny = Object.values(payload).some((value) => value !== undefined)
  return hasAny ? payload : null
}

async function createPanelRequestHandler(request) {
  try {
    const auth = await requirePanelUser(request)
    if (auth.error) return auth.error

    const body = await request.json().catch(() => null)
    const type = body?.type
    if (!REQUEST_TYPES.includes(type)) {
      return json(400, { error: 'Geçersiz talep türü.' })
    }

    const photos = body?.photos || {}
    const kapak = photos.kapak
    const icindekiler = photos.icindekiler
    const cevapAnahtari = photos.cevapAnahtari

    const photoError =
      validatePhotoList(kapak, 'Kapak', { min: 1 }) ||
      (Array.isArray(kapak) && kapak.length > 1 ? 'Yalnızca bir kapak fotoğrafı ekleyin.' : null) ||
      validatePhotoList(icindekiler, 'İçindekiler', { min: 1 }) ||
      validatePhotoList(cevapAnahtari, 'Cevap anahtarı', { min: 0 })
    if (photoError) {
      return json(400, { error: photoError })
    }

    const payload = normalizePayload(body?.book)
    const payloadJson = payload ? JSON.stringify(payload) : null

    const sections = [
      ['kapak', kapak || []],
      ['icindekiler', icindekiler || []],
      ['cevapAnahtari', cevapAnahtari || []],
    ]

    const requestId = await withTransaction(async (requestInTransaction) => {
      const insertResult = await requestInTransaction({
        type: { type: sql.NVarChar(40), value: type },
        payloadJson: { type: sql.NVarChar(sql.MAX), value: payloadJson },
        createdBy: { type: sql.UniqueIdentifier, value: auth.userId },
        createdByRole: { type: sql.NVarChar(20), value: auth.role || null },
      }).query(`
        INSERT INTO dbo.PanelRequests (type, payload_json, created_by_user_id, created_by_role)
        OUTPUT inserted.id
        VALUES (@type, @payloadJson, @createdBy, @createdByRole);
      `)
      const newId = insertResult.recordset[0].id

      for (const [key, list] of sections) {
        const dbSection = PHOTO_SECTIONS[key]
        for (let index = 0; index < list.length; index += 1) {
          await requestInTransaction({
            requestId: { type: sql.UniqueIdentifier, value: newId },
            section: { type: sql.NVarChar(20), value: dbSection },
            sortOrder: { type: sql.Int, value: index },
            photoUrl: { type: sql.NVarChar(sql.MAX), value: list[index].replace(/\s/g, '') },
          }).query(`
            INSERT INTO dbo.PanelRequestPhotos (request_id, section, sort_order, photo_url)
            VALUES (@requestId, @section, @sortOrder, @photoUrl);
          `)
        }
      }

      return newId
    })

    return json(201, {
      request: {
        id: requestId,
        type,
        status: 'beklemede',
        book: payload || {},
        photoCounts: {
          kapak: (kapak || []).length,
          icindekiler: (icindekiler || []).length,
          cevapAnahtari: (cevapAnahtari || []).length,
        },
      },
    })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }
    console.error('createPanelRequestHandler failed', error)
    return json(500, { error: 'Talep oluşturulamadı.' })
  }
}

async function listMyPanelRequestsHandler(request) {
  try {
    const auth = await requirePanelUser(request)
    if (auth.error) return auth.error

    const requestDb = await withRequest({
      userId: { type: sql.UniqueIdentifier, value: auth.userId },
    })
    const result = await requestDb.query(`
      SELECT r.id, r.type, r.status, r.payload_json, r.admin_note,
             r.created_at, r.updated_at, r.reviewed_at,
             ${PHOTO_COUNT_SELECT}
      FROM dbo.PanelRequests r
      WHERE r.created_by_user_id = @userId
      ORDER BY r.created_at DESC;
    `)

    return json(200, { requests: result.recordset.map(sanitizeRequestRow) })
  } catch (error) {
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }
    console.error('listMyPanelRequestsHandler failed', error)
    return json(500, { error: 'Talepler yüklenemedi.' })
  }
}

async function getPanelRequestHandler(request) {
  try {
    const auth = await requirePanelUser(request)
    if (auth.error) return auth.error

    const requestId = request.params.requestId

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: requestId },
    })
    const result = await requestDb.query(`
      SELECT r.id, r.type, r.status, r.payload_json, r.admin_note, r.created_by_user_id,
             r.created_by_role, r.created_at, r.updated_at, r.reviewed_at,
             ${PHOTO_COUNT_SELECT},
             creator.full_name AS creator_name
      FROM dbo.PanelRequests r
      LEFT JOIN dbo.Users creator ON creator.id = r.created_by_user_id
      WHERE r.id = @id;
    `)
    const row = result.recordset[0]
    if (!row) {
      return json(404, { error: 'Talep bulunamadı.' })
    }
    if (!auth.isAdmin && String(row.created_by_user_id).toLowerCase() !== String(auth.userId).toLowerCase()) {
      return json(403, { error: 'Bu talebi görüntüleme yetkiniz yok.' })
    }

    const photosResult = await requestDb.query(`
      SELECT id, section, sort_order, photo_url
      FROM dbo.PanelRequestPhotos
      WHERE request_id = @id
      ORDER BY section ASC, sort_order ASC;
    `)
    const photos = { kapak: [], icindekiler: [], cevapAnahtari: [] }
    const sectionKeyByDb = { kapak: 'kapak', icindekiler: 'icindekiler', 'cevap-anahtari': 'cevapAnahtari' }
    for (const photo of photosResult.recordset) {
      const key = sectionKeyByDb[photo.section]
      if (key) photos[key].push({ id: photo.id, url: photo.photo_url })
    }

    return json(200, {
      request: {
        ...sanitizeRequestRow(row),
        createdByRole: row.created_by_role || null,
        requesterName: row.creator_name || null,
        photos,
      },
    })
  } catch (error) {
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }
    console.error('getPanelRequestHandler failed', error)
    return json(500, { error: 'Talep yüklenemedi.' })
  }
}

async function listAdminPanelRequestsHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const typeFilter = request.query.get('type')
    const statusFilter = request.query.get('status')

    const requestDb = await withRequest({
      type: { type: sql.NVarChar(40), value: REQUEST_TYPES.includes(typeFilter) ? typeFilter : null },
      status: { type: sql.NVarChar(20), value: REQUEST_STATUSES.includes(statusFilter) ? statusFilter : null },
    })
    const result = await requestDb.query(`
      SELECT r.id, r.type, r.status, r.payload_json, r.admin_note,
             r.created_by_role, r.created_at, r.updated_at, r.reviewed_at,
             creator.full_name AS creator_name,
             ${PHOTO_COUNT_SELECT}
      FROM dbo.PanelRequests r
      LEFT JOIN dbo.Users creator ON creator.id = r.created_by_user_id
      WHERE (@type IS NULL OR r.type = @type)
        AND (@status IS NULL OR r.status = @status)
      ORDER BY
        CASE r.status WHEN 'beklemede' THEN 0 ELSE 1 END ASC,
        r.created_at DESC;
    `)

    return json(200, {
      requests: result.recordset.map((row) => ({
        ...sanitizeRequestRow(row),
        createdByRole: row.created_by_role || null,
        requesterName: row.creator_name || null,
      })),
    })
  } catch (error) {
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }
    console.error('listAdminPanelRequestsHandler failed', error)
    return json(500, { error: 'Talepler yüklenemedi.' })
  }
}

async function updateAdminPanelRequestHandler(request) {
  try {
    const { error, session } = await requireAdmin(request)
    if (error) return error

    const requestId = request.params.requestId
    const body = await request.json().catch(() => null)
    const status = body?.status
    if (!ADMIN_STATUSES.includes(status)) {
      return json(400, { error: 'Geçersiz durum. "tamamlandi" veya "iptal" olmalı.' })
    }
    const adminNote =
      typeof body?.adminNote === 'string' && body.adminNote.trim()
        ? body.adminNote.trim().slice(0, 1000)
        : null

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: requestId },
      status: { type: sql.NVarChar(20), value: status },
      adminNote: { type: sql.NVarChar(1000), value: adminNote },
      reviewedBy: { type: sql.UniqueIdentifier, value: session.sub },
    })
    const result = await requestDb.query(`
      UPDATE dbo.PanelRequests
      SET status = @status,
          admin_note = @adminNote,
          reviewed_by_user_id = @reviewedBy,
          reviewed_at = SYSUTCDATETIME(),
          updated_at = SYSUTCDATETIME()
      WHERE id = @id;

      SELECT r.id, r.type, r.status, r.payload_json, r.admin_note,
             r.created_by_role, r.created_at, r.updated_at, r.reviewed_at,
             ${PHOTO_COUNT_SELECT}
      FROM dbo.PanelRequests r
      WHERE r.id = @id;
    `)
    const row = result.recordset[0]
    if (!row) {
      return json(404, { error: 'Talep bulunamadı.' })
    }

    return json(200, { request: sanitizeRequestRow(row) })
  } catch (error) {
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }
    console.error('updateAdminPanelRequestHandler failed', error)
    return json(500, { error: 'Talep güncellenemedi.' })
  }
}

module.exports = {
  createPanelRequestHandler,
  listMyPanelRequestsHandler,
  getPanelRequestHandler,
  listAdminPanelRequestsHandler,
  updateAdminPanelRequestHandler,
}
