const { sql, withRequest, withTransaction } = require('./db')
const { isConfigError } = require('./config')
const { accountDisabledResponse, clearSessionHeaders, createSessionHeaders, json } = require('./http')
const {
  createSessionToken,
  defaultPasswordForPhone,
  hashPassword,
  isSessionError,
  normalizeEmail,
  normalizePhone,
  readSessionToken,
  verifySessionToken,
} = require('./security')
const { normalizeTeacherSubjectIds, parseTeacherSubjectIdsJson } = require('./subjectIds')

async function requireAdmin(request) {
  const token = readSessionToken(request)
  if (!token) {
    return { error: json(401, { error: 'Oturum bulunamadı.' }) }
  }

  const session = verifySessionToken(token)
  const requestDb = await withRequest({
    id: { type: sql.UniqueIdentifier, value: session.sub },
  })
  const result = await requestDb.query(`
    SELECT TOP 1 is_admin, is_active FROM dbo.Users WHERE id = @id;
  `)
  const record = result.recordset[0]

  if (!record) {
    return { error: json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders()) }
  }

  if (record.is_active === false) {
    return { error: accountDisabledResponse() }
  }

  if (!record.is_admin) {
    return { error: json(403, { error: 'Bu alana erişim yetkiniz yok.' }) }
  }

  return { session }
}

// Kütüphane kataloğu (yayın evleri, kaynak kitaplar, içerikler, testler, cevap anahtarları)
// admin dışında öğretmen ve veli paneline de aynı ekranla açılıyor — bu üçü için ortak yetki kontrolü.
async function requireCatalogStaff(request) {
  const token = readSessionToken(request)
  if (!token) {
    return { error: json(401, { error: 'Oturum bulunamadı.' }) }
  }

  const session = verifySessionToken(token)
  const requestDb = await withRequest({
    id: { type: sql.UniqueIdentifier, value: session.sub },
  })
  const result = await requestDb.query(`
    SELECT TOP 1 is_admin, role, is_active FROM dbo.Users WHERE id = @id;
  `)
  const record = result.recordset[0]

  if (!record) {
    return { error: json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders()) }
  }

  if (record.is_active === false) {
    return { error: accountDisabledResponse() }
  }

  if (!record.is_admin && record.role !== 'ogretmen' && record.role !== 'ebeveyn') {
    return { error: json(403, { error: 'Bu alana erişim yetkiniz yok.' }) }
  }

  return { session }
}

// Kütüphane kataloğunda veri işlemi (yayın evi/kaynak/içerik/test/cevap anahtarı ekleme,
// düzenleme, silme). Admin her zaman yetkili; diğer kullanıcılar yalnızca admin panelinden
// can_manage_library bayrağı verilmişse. Yetkisi olmayan öğretmen/veli sadece görüntüler.
async function requireLibraryEditor(request) {
  const token = readSessionToken(request)
  if (!token) {
    return { error: json(401, { error: 'Oturum bulunamadı.' }) }
  }

  const session = verifySessionToken(token)
  const requestDb = await withRequest({
    id: { type: sql.UniqueIdentifier, value: session.sub },
  })
  const result = await requestDb.query(`
    SELECT TOP 1 is_admin, can_manage_library, is_active FROM dbo.Users WHERE id = @id;
  `)
  const record = result.recordset[0]

  if (!record) {
    return { error: json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders()) }
  }

  if (record.is_active === false) {
    return { error: accountDisabledResponse() }
  }

  if (!record.is_admin && !record.can_manage_library) {
    return { error: json(403, { error: 'Kütüphane düzenleme yetkiniz yok.' }) }
  }

  return { session }
}

function sanitizeUser(record) {
  return {
    id: record.id,
    fullName: record.full_name,
    email: record.email,
    phone: record.phone_number,
    role: record.role,
    isAdmin: Boolean(record.is_admin),
    canManageLibrary: Boolean(record.can_manage_library),
    isActive: record.is_active === undefined ? true : Boolean(record.is_active),
    parentId: record.parent_id,
    parentName: record.parent_full_name,
    lastLoginAt: record.last_login_at,
    createdAt: record.created_at,
    teacherSubjectIds: record.role === 'ogretmen' ? parseTeacherSubjectIdsJson(record.teacher_subject_ids_json) : undefined,
  }
}

async function listUsersHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT u.id, u.full_name, u.email, u.phone_number, u.role, u.is_admin, u.can_manage_library, u.is_active, u.parent_id,
             p.full_name AS parent_full_name, u.last_login_at, u.created_at, u.teacher_subject_ids_json
      FROM dbo.Users u
      LEFT JOIN dbo.Users p ON p.id = u.parent_id
      ORDER BY u.created_at ASC;
    `)

    // Öğretmen hesabına bağlanmış öğrenci-öğretmen ilişkileri (Üyeler ekranında
    // "Öğretmenler" sekmesinde bağlı öğrencileri girintili göstermek için).
    const linksDb = await withRequest({})
    const linksResult = await linksDb.query(`
      SELECT DISTINCT st.teacher_user_id, st.student_id
      FROM dbo.StudentTeachers st
      WHERE st.teacher_user_id IS NOT NULL;
    `)
    const teacherLinks = linksResult.recordset.map((row) => ({
      teacherId: row.teacher_user_id,
      studentId: row.student_id,
    }))

    return json(200, { users: result.recordset.map(sanitizeUser), teacherLinks })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listUsersHandler failed', error)
    return json(500, { error: 'Kullanıcılar yüklenemedi.' })
  }
}

async function updateUserHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const userId = request.params.userId
    const payload = await request.json().catch(() => null)
    const fullName = payload?.fullName?.trim()
    const isAdmin = payload?.isAdmin
    // Alan gönderilmezse mevcut değeri koru (geriye dönük uyumluluk); admin ise zaten yetkili.
    const canManageLibraryProvided = typeof payload?.canManageLibrary === 'boolean'
    const canManageLibrary = payload?.canManageLibrary === true

    if (!fullName || fullName.length < 2) {
      return json(400, { error: 'Ad soyad en az 2 karakter olmalı.' })
    }
    if (typeof isAdmin !== 'boolean') {
      return json(400, { error: 'Admin bilgisi geçersiz.' })
    }

    let email = null
    if (payload?.email && payload.email.trim()) {
      email = normalizeEmail(payload.email)
    }

    let phone = null
    if (payload?.phone && payload.phone.trim()) {
      phone = normalizePhone(payload.phone)
      if (!phone) {
        return json(400, { error: 'Telefon numarası geçersiz.' })
      }
    }

    if (!email && !phone) {
      return json(400, { error: 'E-posta veya telefon numarasından en az biri girilmeli.' })
    }

    const subjectIdsProvided = typeof payload?.subjectIds !== 'undefined'
    let teacherSubjectIds = []
    if (subjectIdsProvided) {
      const subjectIdsResult = normalizeTeacherSubjectIds(payload.subjectIds)
      if (subjectIdsResult.error) {
        return json(400, { error: subjectIdsResult.error })
      }
      teacherSubjectIds = subjectIdsResult.value
    }

    // Telefon numarası (yeniden) girildiğinde, kullanıcının bağımsız giriş şifresini
    // de (telefonun son 6 hanesi) günceller.
    const passwordHash = phone ? await hashPassword(defaultPasswordForPhone(phone)) : null

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: userId },
      fullName: { type: sql.NVarChar(120), value: fullName },
      email: { type: sql.NVarChar(320), value: email },
      phone: { type: sql.NVarChar(20), value: phone },
      passwordHash: { type: sql.NVarChar(255), value: passwordHash },
      isAdmin: { type: sql.Bit, value: isAdmin },
      canManageLibraryProvided: { type: sql.Bit, value: canManageLibraryProvided },
      canManageLibrary: { type: sql.Bit, value: canManageLibrary },
      subjectIdsProvided: { type: sql.Bit, value: subjectIdsProvided },
      teacherSubjectIdsJson: {
        type: sql.NVarChar(sql.MAX),
        value: teacherSubjectIds.length ? JSON.stringify(teacherSubjectIds) : null,
      },
    })

    const result = await requestDb.query(`
      UPDATE dbo.Users
      SET full_name = @fullName, email = @email, phone_number = @phone, is_admin = @isAdmin,
          can_manage_library = CASE WHEN @canManageLibraryProvided = 1 THEN @canManageLibrary ELSE can_manage_library END,
          password_hash = CASE WHEN @phone IS NOT NULL THEN @passwordHash ELSE password_hash END,
          teacher_subject_ids_json = CASE WHEN @subjectIdsProvided = 1 THEN @teacherSubjectIdsJson ELSE teacher_subject_ids_json END
      WHERE id = @id;

      SELECT u.id, u.full_name, u.email, u.phone_number, u.role, u.is_admin, u.can_manage_library, u.is_active, u.parent_id,
             p.full_name AS parent_full_name, u.last_login_at, u.created_at, u.teacher_subject_ids_json
      FROM dbo.Users u
      LEFT JOIN dbo.Users p ON p.id = u.parent_id
      WHERE u.id = @id;
    `)

    const updated = result.recordset[0]
    if (!updated) {
      return json(404, { error: 'Kullanıcı bulunamadı.' })
    }

    if (updated.role === 'ogrenci') {
      const profileDb = await withRequest({
        studentId: { type: sql.UniqueIdentifier, value: userId },
        phone: { type: sql.NVarChar(30), value: phone },
      })
      await profileDb.query(`
        MERGE dbo.StudentProfiles AS target
        USING (SELECT @studentId AS student_id) AS src
        ON target.student_id = src.student_id
        WHEN MATCHED THEN UPDATE SET phone = @phone
        WHEN NOT MATCHED THEN INSERT (student_id, phone) VALUES (@studentId, @phone);
      `)
    }

    return json(200, { user: sanitizeUser(updated) })
  } catch (error) {
    if (error.number === 2601 || error.number === 2627) {
      return json(409, { error: 'Bu e-posta veya telefon numarası başka bir kullanıcı tarafından kullanılıyor.' })
    }

    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('updateUserHandler failed', error)
    return json(500, { error: 'Kullanıcı güncellenemedi.' })
  }
}

// Bir üyeyi pasife / aktife alır (is_active). Pasif üye giriş yapamaz; açık oturumu
// varsa /auth/me ve panel guard'ları 403 ACCOUNT_DISABLED döndürür ve istemci oturumu
// kapatır. Kayıt SİLİNMEZ — tüm veri (öğrenci, ödev, ders programı) korunur.
async function setUserActiveHandler(request) {
  try {
    const { error, session } = await requireAdmin(request)
    if (error) {
      return error
    }

    const userId = request.params.userId
    const payload = await request.json().catch(() => null)
    if (typeof payload?.isActive !== 'boolean') {
      return json(400, { error: 'isActive alanı zorunlu.' })
    }

    if (userId === session.sub) {
      return json(400, { error: 'Kendi hesabınızı pasife alamazsınız.' })
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: userId },
      isActive: { type: sql.Bit, value: payload.isActive },
    })
    const result = await requestDb.query(`
      UPDATE dbo.Users
      SET is_active = @isActive,
          -- Aktife alırken varsa giriş kilidini de kaldır (pasife alınırken konmuş olabilir).
          failed_login_count = CASE WHEN @isActive = 1 THEN 0 ELSE failed_login_count END,
          lockout_until = CASE WHEN @isActive = 1 THEN NULL ELSE lockout_until END
      WHERE id = @id;

      SELECT u.id, u.full_name, u.email, u.phone_number, u.role, u.is_admin, u.can_manage_library, u.is_active, u.parent_id,
             p.full_name AS parent_full_name, u.last_login_at, u.created_at, u.teacher_subject_ids_json
      FROM dbo.Users u
      LEFT JOIN dbo.Users p ON p.id = u.parent_id
      WHERE u.id = @id;
    `)

    const updated = result.recordset[0]
    if (!updated) {
      return json(404, { error: 'Kullanıcı bulunamadı.' })
    }

    return json(200, { user: sanitizeUser(updated) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('setUserActiveHandler failed', error)
    return json(500, { error: 'Kullanıcı durumu güncellenemedi.' })
  }
}

async function deleteUserHandler(request) {
  try {
    const { error, session } = await requireAdmin(request)
    if (error) {
      return error
    }

    const userId = request.params.userId

    if (userId === session.sub) {
      return json(400, { error: 'Kendi hesabınızı silemezsiniz.' })
    }

    // Entitlements/TeacherEntitlements satırları kullanıcının kendi hesap hakkı durumudur (1:1,
    // PK = kullanıcı id'si) — gerçek bir bağımlılık değil, o yüzden kullanıcıyla birlikte silinir.
    // Bunun dışında kalan FK'lar (öğrenci verisi, ödev, ders programı vb.) hâlâ silmeyi engeller.
    const rowsAffected = await withTransaction(async (requestInTransaction) => {
      await requestInTransaction({ id: { type: sql.UniqueIdentifier, value: userId } }).query(`
        DELETE FROM dbo.Entitlements WHERE parent_id = @id;
      `)
      await requestInTransaction({ id: { type: sql.UniqueIdentifier, value: userId } }).query(`
        DELETE FROM dbo.TeacherEntitlements WHERE teacher_id = @id;
      `)
      const result = await requestInTransaction({ id: { type: sql.UniqueIdentifier, value: userId } }).query(`
        DELETE FROM dbo.Users WHERE id = @id;
      `)
      return result.rowsAffected[0]
    })

    if (!rowsAffected) {
      return json(404, { error: 'Kullanıcı bulunamadı.' })
    }

    return json(200, { success: true })
  } catch (error) {
    if (error.number === 547) {
      return json(409, {
        error: 'Bu kullanıcının ilişkili kayıtları (öğrenci, ödev, ders programı vb.) olduğu için silinemiyor.',
      })
    }

    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('deleteUserHandler failed', error)
    return json(500, { error: 'Kullanıcı silinemedi.' })
  }
}

// Admin bir üyenin panelini kendi hesabıyla görüntüleyebilsin diye o üye adına yeni bir
// oturum jetonu üretir (payload'a actingAdminId/actingAdminName eklenerek — bkz.
// security.js createSessionToken). "Yönetici Paneline Dön" bu iz sürülen bilgiyle geri döner.
async function impersonateUserHandler(request) {
  try {
    const { error, session } = await requireAdmin(request)
    if (error) {
      return error
    }

    const targetId = request.params.userId
    if (targetId === session.sub) {
      return json(400, { error: 'Zaten bu hesapla oturum açık.' })
    }

    const requestDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: targetId } })
    const result = await requestDb.query(`
      SELECT u.id, u.full_name, u.email, u.phone_number, u.role, u.is_admin, u.can_manage_library, u.is_active, u.parent_id,
             p.full_name AS parent_full_name, u.last_login_at, u.created_at, u.teacher_subject_ids_json,
             sp.theme_id,
             e.status AS entitlement_status, e.source AS entitlement_source,
             e.current_period_end AS entitlement_current_period_end
      FROM dbo.Users u
      LEFT JOIN dbo.Users p ON p.id = u.parent_id
      LEFT JOIN dbo.StudentProfiles sp ON sp.student_id = u.id
      LEFT JOIN dbo.Entitlements e ON e.parent_id = COALESCE(u.parent_id, u.id)
      WHERE u.id = @id;
    `)
    const record = result.recordset[0]
    if (!record) {
      return json(404, { error: 'Kullanıcı bulunamadı.' })
    }
    if (record.is_active === false) {
      return json(409, { error: 'Bu üye pasife alınmış. Önce aktife alın.' })
    }

    const user = sanitizeUser(record)
    const token = createSessionToken(user, {
      actingAdminId: session.sub,
      actingAdminName: session.fullName,
    })

    const responseUser = {
      ...user,
      actingAdmin: { id: session.sub, fullName: session.fullName },
      entitlement: {
        status: record.entitlement_status || 'none',
        source: record.entitlement_source || null,
        currentPeriodEnd: record.entitlement_current_period_end || null,
      },
    }

    return json(200, { user: responseUser }, createSessionHeaders(token))
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('impersonateUserHandler failed', error)
    return json(500, { error: 'Üyenin paneline giriş yapılamadı.' })
  }
}

const TEACHER_ENTITLEMENT_STATUSES = new Set(['none', 'trial', 'active', 'grace_period', 'cancelled', 'expired'])

// Gerçek RevenueCat sandbox webhook'u kurulmadan önce (ve destek ekibinin manuel düzeltme
// yapabilmesi için) öğretmen panel kotasını admin panelinden "comp" kaynaklı olarak elle ayarlar.
async function grantTeacherEntitlementHandler(request) {
  try {
    const { error, session } = await requireAdmin(request)
    if (error) {
      return error
    }

    const teacherId = request.params.userId
    const payload = await request.json().catch(() => null)
    const status = payload?.status
    const baseSeats = Number.isFinite(Number(payload?.baseSeats)) ? Number(payload.baseSeats) : 4
    const purchasedSeats = Number.isFinite(Number(payload?.purchasedSeats)) ? Number(payload.purchasedSeats) : 0

    if (!TEACHER_ENTITLEMENT_STATUSES.has(status)) {
      return json(400, { error: 'Geçerli bir durum seçilmeli.' })
    }
    if (baseSeats < 0 || purchasedSeats < 0) {
      return json(400, { error: 'Koltuk sayıları negatif olamaz.' })
    }

    const teacherDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: teacherId } })
    const teacherResult = await teacherDb.query(`
      SELECT TOP 1 id FROM dbo.Users WHERE id = @id AND role = 'ogretmen';
    `)
    if (!teacherResult.recordset[0]) {
      return json(404, { error: 'Öğretmen bulunamadı.' })
    }

    const upsertDb = await withRequest({
      teacherId: { type: sql.UniqueIdentifier, value: teacherId },
      status: { type: sql.NVarChar(20), value: status },
      baseSeats: { type: sql.Int, value: baseSeats },
      purchasedSeats: { type: sql.Int, value: purchasedSeats },
      grantedBy: { type: sql.UniqueIdentifier, value: session.sub },
      grantedReason: { type: sql.NVarChar(255), value: payload?.reason || null },
    })
    await upsertDb.query(`
      MERGE dbo.TeacherEntitlements AS target
      USING (SELECT @teacherId AS teacher_id) AS source_row
      ON target.teacher_id = source_row.teacher_id
      WHEN MATCHED THEN
        UPDATE SET status = @status, source = 'comp', product_id = NULL, current_period_end = NULL,
                   base_seats = @baseSeats, purchased_seats = @purchasedSeats,
                   granted_by = @grantedBy, granted_reason = @grantedReason
      WHEN NOT MATCHED THEN
        INSERT (teacher_id, status, source, base_seats, purchased_seats, granted_by, granted_reason)
        VALUES (@teacherId, @status, 'comp', @baseSeats, @purchasedSeats, @grantedBy, @grantedReason);
    `)

    return json(200, { ok: true })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }
    console.error('grantTeacherEntitlementHandler failed', error)
    return json(500, { error: 'Öğretmen kotası güncellenemedi.' })
  }
}

async function returnToAdminHandler(request) {
  try {
    const token = readSessionToken(request)
    if (!token) {
      return json(401, { error: 'Oturum bulunamadı.' })
    }

    const session = verifySessionToken(token)
    if (!session.actingAdminId) {
      return json(400, { error: 'Aktif bir yönetici görünümü yok.' })
    }

    const requestDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: session.actingAdminId } })
    const result = await requestDb.query(`
      SELECT u.id, u.full_name, u.email, u.phone_number, u.role, u.is_admin, u.can_manage_library, u.parent_id,
             p.full_name AS parent_full_name, u.last_login_at, u.created_at,
             e.status AS entitlement_status, e.source AS entitlement_source,
             e.current_period_end AS entitlement_current_period_end
      FROM dbo.Users u
      LEFT JOIN dbo.Users p ON p.id = u.parent_id
      LEFT JOIN dbo.Entitlements e ON e.parent_id = COALESCE(u.parent_id, u.id)
      WHERE u.id = @id;
    `)
    const record = result.recordset[0]
    if (!record || !record.is_admin) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    const user = sanitizeUser(record)
    user.entitlement = {
      status: record.entitlement_status || 'none',
      source: record.entitlement_source || null,
      currentPeriodEnd: record.entitlement_current_period_end || null,
    }

    const newToken = createSessionToken(user)
    return json(200, { user }, createSessionHeaders(newToken))
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('returnToAdminHandler failed', error)
    return json(500, { error: 'Yönetici paneline dönülemedi.' })
  }
}

module.exports = {
  listUsersHandler,
  requireAdmin,
  requireCatalogStaff,
  requireLibraryEditor,
  updateUserHandler,
  setUserActiveHandler,
  deleteUserHandler,
  impersonateUserHandler,
  returnToAdminHandler,
  grantTeacherEntitlementHandler,
}
