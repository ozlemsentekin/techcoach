const { sql, withRequest, withTransaction } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const { isSessionError } = require('./security')
const { requireBookshelfActor, fetchStudentTeacherId } = require('./bookshelfScope')

const RESOURCE_BOOK_TYPES = ['konu_anlatimi', 'soru_bankasi', 'okuma_kitabi', 'etkinlik']
const RESOURCE_BOOK_GRADES = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'])
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const MAX_RESOURCE_IMAGE_LENGTH = 350000
const RESOURCE_IMAGE_DATA_URL_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i

function handleError(error, label, fallback) {
  if (isConfigError(error)) {
    return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
  }
  if (isSessionError(error)) {
    return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
  }
  console.error(`${label} failed`, error)
  return json(500, { error: fallback })
}

function sanitizeImageUrl(value) {
  const imageUrl = value?.trim() || null
  if (!imageUrl) return { value: null }
  if (imageUrl.length > MAX_RESOURCE_IMAGE_LENGTH) {
    return { error: 'Görsel dosyası çok büyük. Daha küçük bir görsel yükleyin.' }
  }
  if (
    imageUrl.startsWith('https://') ||
    imageUrl.startsWith('http://') ||
    RESOURCE_IMAGE_DATA_URL_PATTERN.test(imageUrl)
  ) {
    return { value: imageUrl }
  }
  return { error: 'Görsel için geçerli bir URL veya JPG/PNG/WEBP dosyası kullanılmalı.' }
}

// dbo.ResourceBooks tablosunda page_count kolonu (drop-resource-book-page-count-schema.sql
// ile kaldırılıyor) bazı ortamlarda hâlâ NOT NULL olabilir; migration henüz çalışmamışsa
// INSERT'e 1 değerini ekleyebilmek için kolon varlığını bir kez kontrol edip önbelleğe alırız.
let resourceBooksHasPageCount = null
async function hasResourceBooksPageCount() {
  if (resourceBooksHasPageCount !== null) return resourceBooksHasPageCount
  const db = await withRequest({})
  const result = await db.query(`SELECT COL_LENGTH('dbo.ResourceBooks', 'page_count') AS has_col;`)
  resourceBooksHasPageCount = result.recordset[0]?.has_col != null
  return resourceBooksHasPageCount
}

function shapeBook(row, assignmentRows, ctx) {
  // Katalog (genel) kaynaklar öğretmenin Kitaplık'ında salt görüntülenir: içerik/atama/silme
  // yalnızca özel kaynaklarda açıktır.
  const isPrivate = (row.scope || 'private') === 'private'
  const mine =
    isPrivate &&
    !ctx.isActingAsStudent &&
    String(row.created_by_user_id || '').toLowerCase() === String(ctx.actorId).toLowerCase()
  const assignedAll = (assignmentRows || []).map((a) => ({
    id: a.student_id,
    fullName: a.full_name,
    grade: a.grade || null,
    archived: Boolean(row.grade && a.grade && String(a.grade) !== String(row.grade)),
    manageable: ctx.manageableStudentIds.has(String(a.student_id).toLowerCase()),
  }))
  // Admin her atamayı görür ve yönetebilir; veli/öğretmen yalnızca kendi öğrencilerini.
  const named = assignedAll.filter((a) => ctx.isAdmin || a.manageable)
  const editableAssigned = assignedAll.filter((a) => ctx.isAdmin || a.manageable)
  const allArchived = named.length > 0 && named.every((a) => a.archived)

  return {
    id: row.id,
    name: row.name,
    subjectId: row.subject_id,
    subjectName: row.subject_name || null,
    publisherId: row.publisher_id,
    publisherName: row.publisher_name || null,
    grade: row.grade || null,
    type: row.resource_type,
    scope: isPrivate ? 'private' : 'catalog',
    hasAnswerKey: Boolean(row.has_answer_key),
    imageUrl: row.image_url || null,
    createdByUserId: row.created_by_user_id,
    createdByRole: row.created_by_role || null,
    createdByName: row.created_by_name || null,
    createdByMe: mine,
    // İçerik düzenleme ekleyen kişide veya admin'de; admin Kitaplık'ta tam yetkilidir.
    // Katalog kaynaklarında hiçbiri açık değildir (salt görüntüleme).
    canEditContent: isPrivate && (mine || ctx.isAdmin),
    canDelete: isPrivate && (mine || ctx.isAdmin),
    canManageAssignees:
      isPrivate && (ctx.isAdmin || editableAssigned.length > 0 || ctx.manageableStudentIds.size > 0),
    isAdmin: ctx.isAdmin,
    assignedStudents: named,
    assignedManageableStudents: editableAssigned,
    otherAssignedCount: assignedAll.length - named.length,
    assignedCount: assignedAll.length,
    archived: allArchived,
    createdAt: row.created_at,
  }
}

async function fetchAssignmentsByBookIds(bookIds) {
  if (!bookIds.length) return new Map()
  const db = await withRequest({
    bookIdsCsv: { type: sql.NVarChar(sql.MAX), value: bookIds.join(',') },
  })
  const result = await db.query(`
    SELECT srb.resource_book_id, srb.student_id, u.full_name, sp.grade
    FROM dbo.StudentResourceBooks srb
    JOIN STRING_SPLIT(@bookIdsCsv, ',') s ON TRY_CAST(s.value AS UNIQUEIDENTIFIER) = srb.resource_book_id
    JOIN dbo.Users u ON u.id = srb.student_id
    LEFT JOIN dbo.StudentProfiles sp ON sp.student_id = srb.student_id;
  `)
  const map = new Map()
  result.recordset.forEach((row) => {
    const list = map.get(row.resource_book_id) || []
    list.push(row)
    map.set(row.resource_book_id, list)
  })
  return map
}

async function loadPrivateBook(resourceBookId) {
  if (!resourceBookId) return null
  const db = await withRequest({ id: { type: sql.UniqueIdentifier, value: resourceBookId } })
  const result = await db.query(`
    SELECT rb.id, rb.name, rb.subject_id, sub.name AS subject_name, rb.publisher_id, p.name AS publisher_name,
           rb.grade, rb.resource_type, rb.has_answer_key, rb.image_url, rb.is_active, rb.scope,
           rb.created_by_user_id, rb.created_by_role, u.full_name AS created_by_name, rb.created_at
    FROM dbo.ResourceBooks rb
    LEFT JOIN dbo.Subjects sub ON sub.id = rb.subject_id
    LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
    LEFT JOIN dbo.Users u ON u.id = rb.created_by_user_id
    WHERE rb.id = @id AND rb.scope = 'private' AND rb.is_active = 1;
  `)
  return result.recordset[0] || null
}

// getBookHandler için: özel ya da katalog fark etmeksizin aktif kaynağı yükler.
// Görünürlük denetimi actorCanSeeBook'ta scope'a göre yapılır.
async function loadBookRow(resourceBookId) {
  if (!resourceBookId) return null
  const db = await withRequest({ id: { type: sql.UniqueIdentifier, value: resourceBookId } })
  const result = await db.query(`
    SELECT rb.id, rb.name, rb.subject_id, sub.name AS subject_name, rb.publisher_id, p.name AS publisher_name,
           rb.grade, rb.resource_type, rb.has_answer_key, rb.image_url, rb.is_active, rb.scope,
           rb.created_by_user_id, rb.created_by_role, u.full_name AS created_by_name, rb.created_at
    FROM dbo.ResourceBooks rb
    LEFT JOIN dbo.Subjects sub ON sub.id = rb.subject_id
    LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
    LEFT JOIN dbo.Users u ON u.id = rb.created_by_user_id
    WHERE rb.id = @id AND rb.is_active = 1;
  `)
  return result.recordset[0] || null
}

// Bir öğretmenin öğrenci profillerinde takip ettiği (kendi atadığı ya da velinin öğretmene
// atadığı) kaynak mı? StudentTeacherResourceBooks üzerinden bakılır.
async function teacherTracksBook(actorId, resourceBookId) {
  const db = await withRequest({
    actorId: { type: sql.UniqueIdentifier, value: actorId },
    bookId: { type: sql.UniqueIdentifier, value: resourceBookId },
  })
  const result = await db.query(`
    SELECT TOP 1 1 AS ok
    FROM dbo.StudentTeacherResourceBooks strb
    JOIN dbo.StudentTeachers st ON st.id = strb.teacher_id
    WHERE strb.resource_book_id = @bookId AND st.teacher_user_id = @actorId AND st.is_active = 1;
  `)
  return Boolean(result.recordset[0])
}

function actorOwnsBook(book, ctx) {
  // Öğrenci görünümündeki veli sahip sayılmaz: o bağlamda yalnızca öğrencinin üçgenine
  // atanmış kaynakları görüntüleyebilir, içerik düzenleyemez/silemez.
  if (ctx.isActingAsStudent) return false
  return (
    ctx.isAdmin ||
    String(book.created_by_user_id || '').toLowerCase() === String(ctx.actorId).toLowerCase()
  )
}

// Aktörün bir kaynağa atayabileceği öğrenci id'lerini süzer. Veli/öğretmen yalnızca
// yönettiği öğrencilere; admin sistemdeki herhangi bir öğrenciye atayabilir.
async function filterAssignableStudentIds(ctx, requestedIds) {
  const wanted = [...new Set((requestedIds || []).map((id) => String(id).toLowerCase()))].filter(Boolean)
  if (!wanted.length) return []
  if (!ctx.isAdmin) {
    return wanted.filter((id) => ctx.manageableStudentIds.has(id))
  }
  const db = await withRequest({ idsCsv: { type: sql.NVarChar(sql.MAX), value: wanted.join(',') } })
  const result = await db.query(`
    SELECT LOWER(CONVERT(NVARCHAR(36), u.id)) AS id
    FROM dbo.Users u
    JOIN STRING_SPLIT(@idsCsv, ',') s ON TRY_CAST(s.value AS UNIQUEIDENTIFIER) = u.id
    WHERE u.role = 'ogrenci';
  `)
  return result.recordset.map((row) => row.id)
}

async function listAssignableStudentsHandler(request) {
  try {
    const ctx = await requireBookshelfActor(request)
    if (ctx.error) return ctx.error

    let rows = []
    if (ctx.isAdmin) {
      const db = await withRequest({})
      rows = (await db.query(`
        SELECT u.id, u.full_name, sp.grade, pu.full_name AS parent_name
        FROM dbo.Users u
        LEFT JOIN dbo.StudentProfiles sp ON sp.student_id = u.id
        LEFT JOIN dbo.Users pu ON pu.id = u.parent_id
        WHERE u.role = 'ogrenci'
        ORDER BY u.full_name ASC;
      `)).recordset
    } else {
      const ids = [...ctx.manageableStudentIds]
      if (ids.length) {
        const db = await withRequest({ idsCsv: { type: sql.NVarChar(sql.MAX), value: ids.join(',') } })
        rows = (await db.query(`
          SELECT u.id, u.full_name, sp.grade, pu.full_name AS parent_name
          FROM dbo.Users u
          JOIN STRING_SPLIT(@idsCsv, ',') s ON TRY_CAST(s.value AS UNIQUEIDENTIFIER) = u.id
          LEFT JOIN dbo.StudentProfiles sp ON sp.student_id = u.id
          LEFT JOIN dbo.Users pu ON pu.id = u.parent_id
          ORDER BY u.full_name ASC;
        `)).recordset
      }
    }

    return json(200, {
      students: rows.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        grade: r.grade || null,
        parentName: r.parent_name || null,
      })),
    })
  } catch (error) {
    return handleError(error, 'listAssignableStudentsHandler', 'Öğrenciler yüklenemedi.')
  }
}

async function actorCanSeeBook(book, ctx) {
  if (actorOwnsBook(book, ctx)) return true
  if ((book.scope || 'private') !== 'private') {
    // Katalog kaynağı: yalnızca takip eden öğretmen görebilir.
    if (ctx.role !== 'ogretmen' || ctx.isActingAsStudent) return false
    return teacherTracksBook(ctx.actorId, book.id)
  }
  const ids = [...ctx.manageableStudentIds]
  if (!ids.length) return false
  const db = await withRequest({
    bookId: { type: sql.UniqueIdentifier, value: book.id },
    idsCsv: { type: sql.NVarChar(sql.MAX), value: ids.join(',') },
  })
  const result = await db.query(`
    SELECT TOP 1 1 AS ok
    FROM dbo.StudentResourceBooks srb
    JOIN STRING_SPLIT(@idsCsv, ',') s ON TRY_CAST(s.value AS UNIQUEIDENTIFIER) = srb.student_id
    WHERE srb.resource_book_id = @bookId;
  `)
  return Boolean(result.recordset[0])
}

async function listBooksHandler(request) {
  try {
    const ctx = await requireBookshelfActor(request)
    if (ctx.error) return ctx.error

    const filterStudentId = request.query.get('studentId')
    if (filterStudentId && !ctx.manageableStudentIds.has(String(filterStudentId).toLowerCase())) {
      return json(404, { error: 'Öğrenci bulunamadı.' })
    }

    const idsCsv = [...ctx.manageableStudentIds].join(',') || EMPTY_GUID
    const db = await withRequest({
      actorId: { type: sql.UniqueIdentifier, value: ctx.actorId },
      idsCsv: { type: sql.NVarChar(sql.MAX), value: idsCsv },
    })
    const assignedToManageable = `EXISTS (
             SELECT 1 FROM dbo.StudentResourceBooks x
             JOIN STRING_SPLIT(@idsCsv, ',') s ON TRY_CAST(s.value AS UNIQUEIDENTIFIER) = x.student_id
             WHERE x.resource_book_id = rb.id
           )`
    let visibility
    if (ctx.isAdmin) {
      visibility = `rb.scope = 'private' AND rb.is_active = 1`
    } else if (ctx.isActingAsStudent) {
      // Öğrenci görünümü: yalnızca o öğrenciye atanmış kaynaklar (velinin kendi eklediği
      // ama bu öğrenciye atanmamış kaynaklar dahil değil).
      visibility = `rb.scope = 'private' AND rb.is_active = 1 AND ${assignedToManageable}`
    } else if (ctx.role === 'ogretmen') {
      // Öğretmen Kitaplık'ı: kendi eklediği özel kaynaklar + öğrenci profillerinde takip
      // ettiği (kendi ya da velinin öğretmene atadığı) tüm kaynaklar — katalog dahil.
      // Katalog kaynaklar shapeBook'ta salt görüntüleme olarak işaretlenir.
      visibility = `rb.is_active = 1 AND (
           (rb.scope = 'private' AND rb.created_by_user_id = @actorId)
           OR EXISTS (
             SELECT 1 FROM dbo.StudentTeacherResourceBooks strb
             JOIN dbo.StudentTeachers st ON st.id = strb.teacher_id
             WHERE strb.resource_book_id = rb.id
               AND st.teacher_user_id = @actorId
               AND st.is_active = 1
           )
         )`
    } else {
      visibility = `rb.scope = 'private' AND rb.is_active = 1 AND (
           rb.created_by_user_id = @actorId
           OR ${assignedToManageable}
         )`
    }
    const booksResult = await db.query(`
      SELECT rb.id, rb.name, rb.subject_id, sub.name AS subject_name, rb.publisher_id, p.name AS publisher_name,
             rb.grade, rb.resource_type, rb.has_answer_key, rb.image_url, rb.scope,
             rb.created_by_user_id, rb.created_by_role, u.full_name AS created_by_name, rb.created_at
      FROM dbo.ResourceBooks rb
      LEFT JOIN dbo.Subjects sub ON sub.id = rb.subject_id
      LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
      LEFT JOIN dbo.Users u ON u.id = rb.created_by_user_id
      WHERE ${visibility}
      ORDER BY sub.name ASC, rb.name ASC;
    `)

    const books = booksResult.recordset
    const assignmentMap = await fetchAssignmentsByBookIds(books.map((b) => b.id))

    let shaped = books.map((row) => shapeBook(row, assignmentMap.get(row.id), ctx))
    if (filterStudentId) {
      const needle = String(filterStudentId).toLowerCase()
      shaped = shaped
        .filter((book) => book.assignedStudents.some((a) => String(a.id).toLowerCase() === needle))
        .map((book) => {
          const mine = book.assignedStudents.find((a) => String(a.id).toLowerCase() === needle)
          return { ...book, archived: Boolean(mine?.archived) }
        })
    }

    return json(200, { resourceBooks: shaped })
  } catch (error) {
    return handleError(error, 'listBooksHandler', 'Kitaplık yüklenemedi.')
  }
}

async function getBookHandler(request) {
  try {
    const ctx = await requireBookshelfActor(request)
    if (ctx.error) return ctx.error

    const book = await loadBookRow(request.params.resourceBookId)
    if (!book || !(await actorCanSeeBook(book, ctx))) {
      return json(404, { error: 'Kaynak bulunamadı.' })
    }

    const assignmentMap = await fetchAssignmentsByBookIds([book.id])
    const shaped = shapeBook(book, assignmentMap.get(book.id), ctx)

    const contentDb = await withRequest({ bookId: { type: sql.UniqueIdentifier, value: book.id } })
    const topicsResult = await contentDb.query(`
      SELECT id, name FROM dbo.ResourceBookTopics WHERE resource_book_id = @bookId ORDER BY created_at ASC;
    `)
    const testsDb = await withRequest({ bookId: { type: sql.UniqueIdentifier, value: book.id } })
    const testsResult = await testsDb.query(`
      SELECT tt.id, tt.topic_id, tt.topic_name, tt.name, tt.page_start, tt.page_end, tt.question_count,
             (SELECT COUNT(*) FROM dbo.TestAnswerKeys ak WHERE ak.test_id = tt.id) AS answer_key_count
      FROM dbo.ResourceBookTopicTests tt
      INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
      WHERE t.resource_book_id = @bookId
      ORDER BY tt.page_start ASC;
    `)

    return json(200, {
      resourceBook: shaped,
      topics: topicsResult.recordset.map((r) => ({ id: r.id, name: r.name })),
      tests: testsResult.recordset.map((r) => ({
        id: r.id,
        topicId: r.topic_id,
        topicName: r.topic_name,
        name: r.name,
        pageStart: r.page_start,
        pageEnd: r.page_end,
        questionCount: r.question_count,
        hasAnswerKey: r.question_count > 0 && r.answer_key_count === r.question_count,
      })),
    })
  } catch (error) {
    return handleError(error, 'getBookHandler', 'Kaynak yüklenemedi.')
  }
}

function validateBookPayload(payload) {
  const name = payload?.name?.trim()
  const subjectId = payload?.subjectId || null
  const grade = payload?.grade || null
  const type = payload?.type
  const hasAnswerKey = payload?.hasAnswerKey !== false

  if (!name || name.length < 2) return { error: 'Kaynak adı en az 2 karakter olmalı.' }
  if (!subjectId) return { error: 'Ders seçilmeli.' }
  if (!RESOURCE_BOOK_TYPES.includes(type)) return { error: 'Kaynak tipi seçilmeli.' }
  if (!RESOURCE_BOOK_GRADES.has(String(grade))) return { error: 'Sınıf seçilmeli.' }

  const imageResult = sanitizeImageUrl(payload?.imageUrl)
  if (imageResult.error) return { error: imageResult.error }

  return {
    value: {
      name,
      subjectId,
      grade: String(grade),
      type,
      hasAnswerKey: type === 'soru_bankasi' ? hasAnswerKey : true,
      imageUrl: imageResult.value,
    },
  }
}

async function resolvePublisherId(requestInTransaction, { publisherId, newPublisherName }) {
  const trimmed = newPublisherName?.trim()
  if (trimmed) {
    if (trimmed.length < 2) return { error: 'Yayın evi adı en az 2 karakter olmalı.' }
    const existing = await requestInTransaction({ name: { type: sql.NVarChar(150), value: trimmed } }).query(`
      SELECT TOP 1 id FROM dbo.Publishers WHERE name = @name;
    `)
    if (existing.recordset[0]) return { value: existing.recordset[0].id }
    const created = await requestInTransaction({ name: { type: sql.NVarChar(150), value: trimmed } }).query(`
      INSERT INTO dbo.Publishers (name) OUTPUT inserted.id VALUES (@name);
    `)
    return { value: created.recordset[0].id }
  }
  if (!publisherId) return { error: 'Yayın evi seçilmeli.' }
  const found = await requestInTransaction({ id: { type: sql.UniqueIdentifier, value: publisherId } }).query(`
    SELECT TOP 1 id FROM dbo.Publishers WHERE id = @id;
  `)
  if (!found.recordset[0]) return { error: 'Seçilen yayın evi bulunamadı.' }
  return { value: publisherId }
}

async function createBookHandler(request) {
  try {
    const ctx = await requireBookshelfActor(request)
    if (ctx.error) return ctx.error

    const payload = await request.json().catch(() => null)
    const validated = validateBookPayload(payload)
    if (validated.error) return json(400, { error: validated.error })

    const studentIds = await filterAssignableStudentIds(ctx, payload?.studentIds)
    if (!studentIds.length) {
      return json(400, { error: 'En az bir öğrenci seçilmeli.' })
    }

    const withPageCount = await hasResourceBooksPageCount()

    const created = await withTransaction(async (requestInTransaction) => {
      const publisher = await resolvePublisherId(requestInTransaction, {
        publisherId: payload?.publisherId,
        newPublisherName: payload?.newPublisherName,
      })
      if (publisher.error) {
        const err = new Error(publisher.error)
        err.friendly = true
        throw err
      }

      const columns = [
        'publisher_id',
        'subject_id',
        'name',
        'is_active',
        'resource_type',
        'has_answer_key',
        'image_url',
        'grade',
        'resource_source',
        'scope',
        'status',
        'created_by_role',
        'created_by_user_id',
      ]
      const values = [
        '@publisherId',
        '@subjectId',
        '@name',
        '1',
        '@resourceType',
        '@hasAnswerKey',
        '@imageUrl',
        '@grade',
        "'ozel'",
        "'private'",
        "'approved'",
        '@createdByRole',
        '@createdByUserId',
      ]
      if (withPageCount) {
        columns.push('page_count')
        values.push('1')
      }

      const insertResult = await requestInTransaction({
        publisherId: { type: sql.UniqueIdentifier, value: publisher.value },
        subjectId: { type: sql.UniqueIdentifier, value: validated.value.subjectId },
        name: { type: sql.NVarChar(200), value: validated.value.name },
        resourceType: { type: sql.NVarChar(30), value: validated.value.type },
        hasAnswerKey: { type: sql.Bit, value: validated.value.hasAnswerKey },
        imageUrl: { type: sql.NVarChar(sql.MAX), value: validated.value.imageUrl },
        grade: { type: sql.NVarChar(20), value: validated.value.grade },
        createdByRole: { type: sql.NVarChar(20), value: ctx.isAdmin ? 'admin' : ctx.role },
        createdByUserId: { type: sql.UniqueIdentifier, value: ctx.actorId },
      }).query(`
        INSERT INTO dbo.ResourceBooks (${columns.join(', ')})
        OUTPUT inserted.id
        VALUES (${values.join(', ')});
      `)
      const bookId = insertResult.recordset[0].id

      for (const studentId of studentIds) {
        await requestInTransaction({
          studentId: { type: sql.UniqueIdentifier, value: studentId },
          bookId: { type: sql.UniqueIdentifier, value: bookId },
        }).query(`
          INSERT INTO dbo.StudentResourceBooks (student_id, resource_book_id)
          SELECT @studentId, @bookId
          WHERE NOT EXISTS (
            SELECT 1 FROM dbo.StudentResourceBooks
            WHERE student_id = @studentId AND resource_book_id = @bookId
          );
        `)

        if (ctx.role === 'ogretmen') {
          const studentTeacherId = await fetchStudentTeacherId(ctx.actorId, studentId)
          if (studentTeacherId) {
            await requestInTransaction({
              teacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
              studentId: { type: sql.UniqueIdentifier, value: studentId },
              bookId: { type: sql.UniqueIdentifier, value: bookId },
            }).query(`
              INSERT INTO dbo.StudentTeacherResourceBooks (teacher_id, student_id, resource_book_id)
              SELECT @teacherId, @studentId, @bookId
              WHERE NOT EXISTS (
                SELECT 1 FROM dbo.StudentTeacherResourceBooks
                WHERE teacher_id = @teacherId AND resource_book_id = @bookId
              );
            `)
          }
        }
      }

      return bookId
    })

    const book = await loadPrivateBook(created)
    const assignmentMap = await fetchAssignmentsByBookIds([created])
    return json(201, { resourceBook: shapeBook(book, assignmentMap.get(created), ctx) })
  } catch (error) {
    if (error?.friendly) return json(400, { error: error.message })
    if (error?.number === 2601 || error?.number === 2627) {
      return json(409, { error: 'Bu isimde bir yayın evi zaten var.' })
    }
    return handleError(error, 'createBookHandler', 'Kaynak oluşturulamadı.')
  }
}

async function updateBookHandler(request) {
  try {
    const ctx = await requireBookshelfActor(request)
    if (ctx.error) return ctx.error

    const book = await loadPrivateBook(request.params.resourceBookId)
    if (!book) return json(404, { error: 'Kaynak bulunamadı.' })
    if (!actorOwnsBook(book, ctx)) {
      return json(403, { error: 'Bu kaynağı yalnızca ekleyen kişi düzenleyebilir.' })
    }

    const payload = await request.json().catch(() => null)
    const validated = validateBookPayload(payload)
    if (validated.error) return json(400, { error: validated.error })

    const updated = await withTransaction(async (requestInTransaction) => {
      const publisher = await resolvePublisherId(requestInTransaction, {
        publisherId: payload?.publisherId,
        newPublisherName: payload?.newPublisherName,
      })
      if (publisher.error) {
        const err = new Error(publisher.error)
        err.friendly = true
        throw err
      }

      await requestInTransaction({
        id: { type: sql.UniqueIdentifier, value: book.id },
        publisherId: { type: sql.UniqueIdentifier, value: publisher.value },
        subjectId: { type: sql.UniqueIdentifier, value: validated.value.subjectId },
        name: { type: sql.NVarChar(200), value: validated.value.name },
        resourceType: { type: sql.NVarChar(30), value: validated.value.type },
        hasAnswerKey: { type: sql.Bit, value: validated.value.hasAnswerKey },
        imageUrl: { type: sql.NVarChar(sql.MAX), value: validated.value.imageUrl },
        grade: { type: sql.NVarChar(20), value: validated.value.grade },
      }).query(`
        UPDATE dbo.ResourceBooks
        SET publisher_id = @publisherId, subject_id = @subjectId, name = @name,
            resource_type = @resourceType, has_answer_key = @hasAnswerKey, image_url = @imageUrl, grade = @grade
        WHERE id = @id AND scope = 'private';
      `)
      return book.id
    })

    const fresh = await loadPrivateBook(updated)
    const assignmentMap = await fetchAssignmentsByBookIds([updated])
    return json(200, { resourceBook: shapeBook(fresh, assignmentMap.get(updated), ctx) })
  } catch (error) {
    if (error?.friendly) return json(400, { error: error.message })
    return handleError(error, 'updateBookHandler', 'Kaynak güncellenemedi.')
  }
}

async function deleteBookHandler(request) {
  try {
    const ctx = await requireBookshelfActor(request)
    if (ctx.error) return ctx.error

    const book = await loadPrivateBook(request.params.resourceBookId)
    if (!book) return json(404, { error: 'Kaynak bulunamadı.' })
    if (!actorOwnsBook(book, ctx)) {
      return json(403, { error: 'Bu kaynağı yalnızca ekleyen kişi silebilir.' })
    }

    // Referans bütünlüğünü korumak için sert silme yerine pasifleştirme + tüm atamaları kaldırma.
    // is_active = 0 kaynağı her yerde (Kitaplık, öğrenci Kaynaklarım, ödev seçici) gizler;
    // geçmiş ödev kayıtları bozulmaz.
    await withTransaction(async (requestInTransaction) => {
      await requestInTransaction({ id: { type: sql.UniqueIdentifier, value: book.id } }).query(`
        DELETE FROM dbo.StudentTeacherResourceBooks WHERE resource_book_id = @id;
        DELETE FROM dbo.StudentResourceBooks WHERE resource_book_id = @id;
        UPDATE dbo.ResourceBooks SET is_active = 0 WHERE id = @id AND scope = 'private';
      `)
    })

    return json(200, { success: true })
  } catch (error) {
    return handleError(error, 'deleteBookHandler', 'Kaynak silinemedi.')
  }
}

async function setBookStudentsHandler(request) {
  try {
    const ctx = await requireBookshelfActor(request)
    if (ctx.error) return ctx.error

    const book = await loadPrivateBook(request.params.resourceBookId)
    if (!book || !(await actorCanSeeBook(book, ctx))) {
      return json(404, { error: 'Kaynak bulunamadı.' })
    }

    const payload = await request.json().catch(() => null)
    const desired = new Set(await filterAssignableStudentIds(ctx, payload?.studentIds))

    // Mevcut atamalar. Admin hepsini yönetebilir; veli/öğretmen yalnızca kendi öğrencilerini
    // (kapsam dışı atamalara dokunulmaz).
    const currentDb = await withRequest({ bookId: { type: sql.UniqueIdentifier, value: book.id } })
    const currentResult = await currentDb.query(`
      SELECT student_id FROM dbo.StudentResourceBooks WHERE resource_book_id = @bookId;
    `)
    const currentManageable = new Set(
      currentResult.recordset
        .map((r) => String(r.student_id).toLowerCase())
        .filter((id) => ctx.isAdmin || ctx.manageableStudentIds.has(id)),
    )

    const toAdd = [...desired].filter((id) => !currentManageable.has(id))
    const toRemove = [...currentManageable].filter((id) => !desired.has(id))

    await withTransaction(async (requestInTransaction) => {
      for (const studentId of toAdd) {
        await requestInTransaction({
          studentId: { type: sql.UniqueIdentifier, value: studentId },
          bookId: { type: sql.UniqueIdentifier, value: book.id },
        }).query(`
          INSERT INTO dbo.StudentResourceBooks (student_id, resource_book_id)
          SELECT @studentId, @bookId
          WHERE NOT EXISTS (
            SELECT 1 FROM dbo.StudentResourceBooks WHERE student_id = @studentId AND resource_book_id = @bookId
          );
        `)
        if (ctx.role === 'ogretmen') {
          const studentTeacherId = await fetchStudentTeacherId(ctx.actorId, studentId)
          if (studentTeacherId) {
            await requestInTransaction({
              teacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
              studentId: { type: sql.UniqueIdentifier, value: studentId },
              bookId: { type: sql.UniqueIdentifier, value: book.id },
            }).query(`
              INSERT INTO dbo.StudentTeacherResourceBooks (teacher_id, student_id, resource_book_id)
              SELECT @teacherId, @studentId, @bookId
              WHERE NOT EXISTS (
                SELECT 1 FROM dbo.StudentTeacherResourceBooks WHERE teacher_id = @teacherId AND resource_book_id = @bookId
              );
            `)
          }
        }
      }

      for (const studentId of toRemove) {
        // StudentResourceBooks silinince StudentTeacherResourceBooks FK cascade ile temizlenir.
        await requestInTransaction({
          studentId: { type: sql.UniqueIdentifier, value: studentId },
          bookId: { type: sql.UniqueIdentifier, value: book.id },
        }).query(`
          DELETE FROM dbo.StudentResourceBooks WHERE student_id = @studentId AND resource_book_id = @bookId;
        `)
      }
    })

    const assignmentMap = await fetchAssignmentsByBookIds([book.id])
    return json(200, { resourceBook: shapeBook(book, assignmentMap.get(book.id), ctx) })
  } catch (error) {
    return handleError(error, 'setBookStudentsHandler', 'Atama güncellenemedi.')
  }
}

async function createPublisherForPanelHandler(request) {
  try {
    const ctx = await requireBookshelfActor(request)
    if (ctx.error) return ctx.error

    const payload = await request.json().catch(() => null)
    const name = payload?.name?.trim()
    if (!name || name.length < 2) {
      return json(400, { error: 'Yayın evi adı en az 2 karakter olmalı.' })
    }

    const existingDb = await withRequest({ name: { type: sql.NVarChar(150), value: name } })
    const existing = await existingDb.query(`SELECT TOP 1 id, name, created_at FROM dbo.Publishers WHERE name = @name;`)
    if (existing.recordset[0]) {
      const row = existing.recordset[0]
      return json(200, { publisher: { id: row.id, name: row.name, createdAt: row.created_at } })
    }

    const createDb = await withRequest({ name: { type: sql.NVarChar(150), value: name } })
    const created = await createDb.query(`
      INSERT INTO dbo.Publishers (name) OUTPUT inserted.id, inserted.name, inserted.created_at VALUES (@name);
    `)
    const row = created.recordset[0]
    return json(201, { publisher: { id: row.id, name: row.name, createdAt: row.created_at } })
  } catch (error) {
    if (error?.number === 2601 || error?.number === 2627) {
      return json(409, { error: 'Bu isimde bir yayın evi zaten var.' })
    }
    return handleError(error, 'createPublisherForPanelHandler', 'Yayın evi oluşturulamadı.')
  }
}

module.exports = {
  listBooksHandler,
  getBookHandler,
  createBookHandler,
  updateBookHandler,
  deleteBookHandler,
  setBookStudentsHandler,
  createPublisherForPanelHandler,
  listAssignableStudentsHandler,
}
