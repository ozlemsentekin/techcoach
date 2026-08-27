const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const { defaultPasswordForPhone, hashPassword, isSessionError, normalizePhone } = require('./security')
const { requireParentSession, verifyParentOwnsStudent, STUDENT_THEME_IDS } = require('./students')
const { validateScheduleEntries, parseJsonEntries, getStudentSchoolScheduleTemplate } = require('./schoolSchedule')

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_PHOTO_LENGTH = 350000
const PHOTO_DATA_URL_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i
const MAX_INTERESTS = 20
const MAX_INTEREST_LENGTH = 60
const MAX_SUBJECTS = 20

function isGuid(value) {
  return typeof value === 'string' && GUID_PATTERN.test(value.trim())
}

function parseJsonStringArray(value) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function sanitizePhotoUrl(value) {
  const photoUrl = value?.trim() || null
  if (!photoUrl) return { value: null }

  if (photoUrl.length > MAX_PHOTO_LENGTH) {
    return { error: 'Fotoğraf dosyası çok büyük. Daha küçük bir görsel yükleyin.' }
  }

  if (photoUrl.startsWith('https://') || photoUrl.startsWith('http://') || PHOTO_DATA_URL_PATTERN.test(photoUrl)) {
    return { value: photoUrl }
  }

  return { error: 'Fotoğraf için geçerli bir URL veya JPG/PNG/WEBP dosyası kullanılmalı.' }
}

function normalizeInterestList(value, label) {
  if (value === undefined || value === null) {
    return { value: [] }
  }
  if (!Array.isArray(value)) {
    return { error: `${label} listesi geçersiz.` }
  }
  if (value.length > MAX_INTERESTS) {
    return { error: `En fazla ${MAX_INTERESTS} ${label.toLocaleLowerCase('tr-TR')} seçebilirsiniz.` }
  }

  const items = []
  const seen = new Set()
  for (const raw of value) {
    if (typeof raw !== 'string') {
      return { error: `${label} listesi geçersiz.` }
    }
    const trimmed = raw.trim()
    if (!trimmed) continue
    if (trimmed.length > MAX_INTEREST_LENGTH) {
      return { error: `${label} en fazla ${MAX_INTEREST_LENGTH} karakter olmalı.` }
    }
    const key = trimmed.toLocaleLowerCase('tr-TR')
    if (!seen.has(key)) {
      seen.add(key)
      items.push(trimmed)
    }
  }

  return { value: items }
}

function normalizeSubjectIds(value) {
  if (value === undefined || value === null) {
    return { value: [] }
  }
  if (!Array.isArray(value)) {
    return { error: 'Ders listesi geçersiz.' }
  }
  if (value.length > MAX_SUBJECTS) {
    return { error: `En fazla ${MAX_SUBJECTS} ders seçebilirsiniz.` }
  }

  const ids = []
  const seen = new Set()
  for (const raw of value) {
    if (!isGuid(raw)) {
      return { error: 'Ders listesi geçersiz.' }
    }
    const id = raw.trim().toLowerCase()
    if (!seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }

  return { value: ids }
}

function sanitizeStudentProfile(record) {
  if (!record) return null

  return {
    provinceId: record.province_id,
    provinceName: record.province_name || null,
    districtId: record.district_id,
    districtName: record.district_name || null,
    schoolId: record.school_id,
    schoolName: record.school_name || null,
    schoolType: record.school_type || null,
    birthDate: record.birth_date || null,
    supportedTeam: record.supported_team || null,
    grade: record.grade || null,
    gender: record.gender || null,
    themeId: record.theme_id || null,
    phone: record.phone || null,
    photoUrl: record.photo_url || null,
    interestedSports: parseJsonStringArray(record.interested_sports_json),
    interestedArts: parseJsonStringArray(record.interested_arts_json),
    schoolSchedule: parseJsonEntries(record.school_schedule_json),
    subjectIds: parseJsonStringArray(record.subject_ids_json),
    updatedAt: record.updated_at,
  }
}

async function fetchStudentProfile(studentId) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
  })
  const result = await requestDb.query(`
    SELECT sp.province_id, pr.name AS province_name, sp.district_id, d.name AS district_name,
           sp.school_id, s.name AS school_name, s.school_type,
           sp.birth_date, sp.supported_team, sp.grade, sp.phone, sp.photo_url, sp.theme_id, sp.gender,
           sp.interested_sports_json, sp.interested_arts_json, sp.school_schedule_json, sp.subject_ids_json,
           sp.updated_at
    FROM dbo.StudentProfiles sp
    LEFT JOIN dbo.Provinces pr ON pr.id = sp.province_id
    LEFT JOIN dbo.Districts d ON d.id = sp.district_id
    LEFT JOIN dbo.Schools s ON s.id = sp.school_id
    WHERE sp.student_id = @studentId;
  `)

  return sanitizeStudentProfile(result.recordset[0])
}

async function validateGeoSelection({ provinceId, districtId, schoolId }) {
  if (schoolId) {
    if (!districtId || !provinceId) {
      return { error: 'Okul seçmek için il ve ilçe seçilmeli.' }
    }

    const requestDb = await withRequest({
      schoolId: { type: sql.UniqueIdentifier, value: schoolId },
      districtId: { type: sql.UniqueIdentifier, value: districtId },
      provinceId: { type: sql.UniqueIdentifier, value: provinceId },
    })
    const result = await requestDb.query(`
      SELECT TOP 1 id FROM dbo.Schools
      WHERE id = @schoolId AND district_id = @districtId AND province_id = @provinceId AND is_active = 1;
    `)
    if (!result.recordset[0]) {
      return { error: 'Seçilen okul, il/ilçe ile eşleşmiyor.' }
    }
    return {}
  }

  if (districtId) {
    if (!provinceId) {
      return { error: 'İlçe seçmek için il seçilmeli.' }
    }
    const requestDb = await withRequest({
      districtId: { type: sql.UniqueIdentifier, value: districtId },
      provinceId: { type: sql.UniqueIdentifier, value: provinceId },
    })
    const result = await requestDb.query(`
      SELECT TOP 1 id FROM dbo.Districts WHERE id = @districtId AND province_id = @provinceId;
    `)
    if (!result.recordset[0]) {
      return { error: 'Seçilen ilçe, il ile eşleşmiyor.' }
    }
    return {}
  }

  if (provinceId) {
    const requestDb = await withRequest({
      provinceId: { type: sql.UniqueIdentifier, value: provinceId },
    })
    const result = await requestDb.query(`
      SELECT TOP 1 id FROM dbo.Provinces WHERE id = @provinceId;
    `)
    if (!result.recordset[0]) {
      return { error: 'Geçerli bir il seçin.' }
    }
  }

  return {}
}

function validateProfilePayload(payload) {
  if (!payload) {
    return { error: 'Geçersiz istek gövdesi.' }
  }

  const provinceId = payload.provinceId?.trim() || null
  if (provinceId && !isGuid(provinceId)) {
    return { error: 'Geçerli bir il seçin.' }
  }

  const districtId = payload.districtId?.trim() || null
  if (districtId && !isGuid(districtId)) {
    return { error: 'Geçerli bir ilçe seçin.' }
  }

  const schoolId = payload.schoolId?.trim() || null
  if (schoolId && !isGuid(schoolId)) {
    return { error: 'Geçerli bir okul seçin.' }
  }

  const birthDate = payload.birthDate?.trim() || null
  if (birthDate) {
    if (!DATE_PATTERN.test(birthDate) || Number.isNaN(new Date(birthDate).getTime())) {
      return { error: 'Doğum tarihi geçerli olmalı.' }
    }
    if (new Date(birthDate).getTime() > Date.now()) {
      return { error: 'Doğum tarihi gelecekte olamaz.' }
    }
  }

  const supportedTeam = payload.supportedTeam?.trim() || null
  if (supportedTeam && supportedTeam.length > 100) {
    return { error: 'Tutulan takım en fazla 100 karakter olmalı.' }
  }

  const grade = payload.grade?.trim() || null
  if (grade && grade.length > 20) {
    return { error: 'Sınıf bilgisi en fazla 20 karakter olmalı.' }
  }

  // themeId gönderilmezse mevcut değer korunur (ör. oluşturma sırasında cinsiyete göre
  // atanan varsayılan tema, sihirbazın sonraki adımlarında sessizce silinmemeli).
  const themeIdProvided = typeof payload.themeId === 'string' && payload.themeId.trim() !== ''
  const themeId = themeIdProvided ? payload.themeId.trim() : null
  if (themeIdProvided && !STUDENT_THEME_IDS.has(themeId)) {
    return { error: 'Geçersiz panel stili seçimi.' }
  }

  let phone = null
  if (payload.phone && payload.phone.trim()) {
    phone = normalizePhone(payload.phone)
    if (!phone) {
      return { error: 'Telefon numarası geçersiz. Örn: 05XX XXX XX XX' }
    }
  }

  const photoResult = sanitizePhotoUrl(payload.photoUrl)
  if (photoResult.error) {
    return { error: photoResult.error }
  }

  const sportsResult = normalizeInterestList(payload.interestedSports, 'Spor')
  if (sportsResult.error) {
    return { error: sportsResult.error }
  }

  const artsResult = normalizeInterestList(payload.interestedArts, 'Sanat dalı')
  if (artsResult.error) {
    return { error: artsResult.error }
  }

  const scheduleResult = validateScheduleEntries(payload.schoolSchedule)
  if (scheduleResult.error) {
    return { error: scheduleResult.error }
  }

  const subjectIdsResult = normalizeSubjectIds(payload.subjectIds)
  if (subjectIdsResult.error) {
    return { error: subjectIdsResult.error }
  }

  return {
    value: {
      provinceId,
      districtId,
      schoolId,
      birthDate,
      supportedTeam,
      grade,
      phone,
      photoUrl: photoResult.value,
      interestedSports: sportsResult.value,
      interestedArts: artsResult.value,
      schoolSchedule: scheduleResult.value,
      subjectIds: subjectIdsResult.value,
      themeId,
      themeIdProvided,
    },
  }
}

async function getStudentProfileHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const studentId = request.params.studentId
    const ownsStudent = await verifyParentOwnsStudent(parentId, studentId)
    if (!ownsStudent) {
      return json(404, { error: 'Öğrenci bulunamadı.' })
    }

    const profile = await fetchStudentProfile(studentId)

    // Öğrenci için henüz kendi ders programı girilmemişse, ama okulu ve sınıfı biliniyorsa,
    // aynı okul+sınıf için tanımlı admin şablonunu öneri olarak döneriz (kaydedilmez, sadece
    // sihirbaz/profil ekranında ön dolgu için kullanılır).
    let suggestedSchoolSchedule = []
    if (profile && profile.schoolSchedule.length === 0 && profile.schoolId && profile.grade) {
      suggestedSchoolSchedule = await getStudentSchoolScheduleTemplate(profile.schoolId, profile.grade)
    }

    return json(200, { profile: profile ? { ...profile, suggestedSchoolSchedule } : profile })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('getStudentProfileHandler failed', error)
    return json(500, { error: 'Profil yüklenemedi.' })
  }
}

async function updateStudentProfileHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const studentId = request.params.studentId
    const ownsStudent = await verifyParentOwnsStudent(parentId, studentId)
    if (!ownsStudent) {
      return json(404, { error: 'Öğrenci bulunamadı.' })
    }

    const payload = await request.json().catch(() => null)
    const validationResult = validateProfilePayload(payload)
    if (validationResult.error) {
      return json(400, { error: validationResult.error })
    }

    const profile = validationResult.value

    const geoValidation = await validateGeoSelection(profile)
    if (geoValidation.error) {
      return json(400, { error: geoValidation.error })
    }

    // Öğrenci telefonu, veli profilinden ilk kez girildiğinde ya da değiştirildiğinde,
    // öğrencinin bağımsız giriş şifresini de (telefonun son 6 hanesi) günceller.
    const passwordHash = profile.phone ? await hashPassword(defaultPasswordForPhone(profile.phone)) : null

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      provinceId: { type: sql.UniqueIdentifier, value: profile.provinceId },
      districtId: { type: sql.UniqueIdentifier, value: profile.districtId },
      schoolId: { type: sql.UniqueIdentifier, value: profile.schoolId },
      birthDate: { type: sql.Date, value: profile.birthDate },
      supportedTeam: { type: sql.NVarChar(100), value: profile.supportedTeam },
      grade: { type: sql.NVarChar(20), value: profile.grade },
      phone: { type: sql.NVarChar(30), value: profile.phone },
      passwordHash: { type: sql.NVarChar(255), value: passwordHash },
      photoUrl: { type: sql.NVarChar(sql.MAX), value: profile.photoUrl },
      themeId: { type: sql.NVarChar(20), value: profile.themeId },
      themeIdProvided: { type: sql.Bit, value: profile.themeIdProvided },
      interestedSportsJson: {
        type: sql.NVarChar(sql.MAX),
        value: profile.interestedSports.length ? JSON.stringify(profile.interestedSports) : null,
      },
      interestedArtsJson: {
        type: sql.NVarChar(sql.MAX),
        value: profile.interestedArts.length ? JSON.stringify(profile.interestedArts) : null,
      },
      schoolScheduleJson: {
        type: sql.NVarChar(sql.MAX),
        value: profile.schoolSchedule.length ? JSON.stringify(profile.schoolSchedule) : null,
      },
      subjectIdsJson: {
        type: sql.NVarChar(sql.MAX),
        value: profile.subjectIds.length ? JSON.stringify(profile.subjectIds) : null,
      },
    })

    await requestDb.query(`
      UPDATE dbo.Users
      SET phone_number = @phone,
          password_hash = CASE
            WHEN @phone IS NOT NULL AND (phone_number IS NULL OR phone_number <> @phone) THEN @passwordHash
            ELSE password_hash
          END
      WHERE id = @studentId;

      MERGE dbo.StudentProfiles AS target
      USING (SELECT @studentId AS student_id) AS src
      ON target.student_id = src.student_id
      WHEN MATCHED THEN UPDATE SET
        province_id = @provinceId,
        district_id = @districtId,
        school_id = @schoolId,
        birth_date = @birthDate,
        supported_team = @supportedTeam,
        grade = @grade,
        phone = @phone,
        photo_url = @photoUrl,
        theme_id = CASE WHEN @themeIdProvided = 1 THEN @themeId ELSE target.theme_id END,
        interested_sports_json = @interestedSportsJson,
        interested_arts_json = @interestedArtsJson,
        school_schedule_json = @schoolScheduleJson,
        subject_ids_json = @subjectIdsJson
      WHEN NOT MATCHED THEN INSERT
        (student_id, province_id, district_id, school_id, birth_date, supported_team, grade, phone, photo_url, theme_id, interested_sports_json, interested_arts_json, school_schedule_json, subject_ids_json)
        VALUES (@studentId, @provinceId, @districtId, @schoolId, @birthDate, @supportedTeam, @grade, @phone, @photoUrl, @themeId, @interestedSportsJson, @interestedArtsJson, @schoolScheduleJson, @subjectIdsJson);
    `)

    const savedProfile = await fetchStudentProfile(studentId)
    return json(200, { profile: savedProfile })
  } catch (error) {
    if (error.number === 2601 || error.number === 2627) {
      return json(409, { error: 'Bu telefon numarası başka bir hesapta kayıtlı, öğrenci girişi için kullanılamaz.' })
    }

    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('updateStudentProfileHandler failed', error)
    return json(500, { error: 'Profil kaydedilemedi.' })
  }
}

module.exports = {
  getStudentProfileHandler,
  updateStudentProfileHandler,
  fetchStudentProfile,
  validateGeoSelection,
  sanitizePhotoUrl,
}
