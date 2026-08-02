const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const localSettingsPath = path.join(__dirname, '..', 'local.settings.json')

function loadLocalSettings() {
  if (!fs.existsSync(localSettingsPath)) return
  const parsed = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([key, value]) => {
    if (!process.env[key] && typeof value === 'string') {
      process.env[key] = value
    }
  })
}

const PUBLISHER_NAME = 'Hız Yayınları'
const SUBJECT_NAME = 'Fen Bilimleri'
const BOOK_NAME = '8. Sınıf Fen Bilimleri 36 Haftalık Kazanım Denemeleri'
const BOOK_PAGE_COUNT = 377
const QUESTIONS_PER_DENEME = 20
const PAGES_PER_DENEME = 8
const FIRST_PAGE = 2 // page 1 is the book's cover/title page, not part of any deneme

// Each entry is one "deneme" booklet (~8 pages), read directly off the book's own hafta/ünite
// header pages. `no` is the deneme's own sequence number (matches the book's "DENEME-NN" label
// and drives the page range: Deneme N spans pages [FIRST_PAGE + (N-1)*8, ... + 7]).
// Only denemeler 1-23 are entered now (through the first "Yarıyıl Değerlendirme"); the rest of
// the 47 will be added later.
const DENEMELER = [
  { no: 1, topicLabel: '01. Hafta - Mevsimlerin Oluşumu' },
  { no: 2, topicLabel: '02. Hafta - Mevsimlerin Oluşumu' },
  { no: 3, topicLabel: '03. Hafta - İklim ve Hava Hareketleri' },
  { no: 4, topicLabel: '1. Ünite Değerlendirme' },
  { no: 5, topicLabel: '04. Hafta - DNA ve Genetik Kod' },
  { no: 6, topicLabel: '05. Hafta - Kalıtım' },
  { no: 7, topicLabel: '06. Hafta - Kalıtım' },
  { no: 8, topicLabel: '07. Hafta - Kalıtım' },
  { no: 9, topicLabel: '08. Hafta - Mutasyon ve Modifikasyon, Adaptasyon (Çevreye Uyum)' },
  { no: 10, topicLabel: '09. Hafta - Biyoteknoloji' },
  { no: 11, topicLabel: '2. Ünite Değerlendirme' },
  { no: 12, topicLabel: '1. Ara Tatil Değerlendirme' },
  { no: 13, topicLabel: '10. Hafta - Katı Basıncı' },
  { no: 14, topicLabel: '11. Hafta - Sıvı Basıncı' },
  { no: 15, topicLabel: '12. Hafta - Gaz Basıncı' },
  { no: 16, topicLabel: '3. Ünite Değerlendirme' },
  { no: 17, topicLabel: '13. Hafta - Periyodik Sistem' },
  { no: 18, topicLabel: '14. Hafta - Fiziksel ve Kimyasal Değişimler' },
  { no: 19, topicLabel: '15. Hafta - Kimyasal Tepkimeler' },
  { no: 20, topicLabel: '16. Hafta - Asitler ve Bazlar' },
  { no: 21, topicLabel: '17. Hafta - Asitler ve Bazlar' },
  { no: 22, topicLabel: 'Yarıyıl Değerlendirme (1)' },
  { no: 23, topicLabel: 'Yarıyıl Değerlendirme (2)' },
]

function pageRangeFor(no) {
  const pageStart = FIRST_PAGE + (no - 1) * PAGES_PER_DENEME
  const pageEnd = pageStart + PAGES_PER_DENEME - 1
  return { pageStart, pageEnd }
}

async function getPublisherId(pool) {
  const result = await pool
    .request()
    .input('name', sql.NVarChar(150), PUBLISHER_NAME)
    .query('SELECT id FROM dbo.Publishers WHERE name = @name;')
  if (!result.recordset.length) throw new Error(`Publisher not found: ${PUBLISHER_NAME}`)
  return result.recordset[0].id
}

async function getSubjectId(pool) {
  const result = await pool
    .request()
    .input('name', sql.NVarChar(100), SUBJECT_NAME)
    .query('SELECT id FROM dbo.Subjects WHERE name = @name;')
  if (!result.recordset.length) throw new Error(`Subject not found: ${SUBJECT_NAME}`)
  return result.recordset[0].id
}

async function getOrCreateResourceBook(pool, publisherId, subjectId) {
  const existing = await pool
    .request()
    .input('publisherId', sql.UniqueIdentifier, publisherId)
    .input('name', sql.NVarChar(200), BOOK_NAME)
    .query('SELECT id FROM dbo.ResourceBooks WHERE publisher_id = @publisherId AND name = @name;')

  if (existing.recordset.length) {
    return existing.recordset[0].id
  }

  const inserted = await pool
    .request()
    .input('publisherId', sql.UniqueIdentifier, publisherId)
    .input('subjectId', sql.UniqueIdentifier, subjectId)
    .input('name', sql.NVarChar(200), BOOK_NAME)
    .input('pageCount', sql.Int, BOOK_PAGE_COUNT)
    .input('isActive', sql.Bit, true)
    .input('resourceType', sql.NVarChar(30), 'soru_bankasi')
    .input('hasAnswerKey', sql.Bit, true).query(`
      INSERT INTO dbo.ResourceBooks (publisher_id, subject_id, name, page_count, is_active, resource_type, has_answer_key)
      OUTPUT inserted.id
      VALUES (@publisherId, @subjectId, @name, @pageCount, @isActive, @resourceType, @hasAnswerKey);
    `)

  return inserted.recordset[0].id
}

async function insertTopic(pool, resourceBookId, name) {
  const result = await pool
    .request()
    .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
    .input('name', sql.NVarChar(200), name).query(`
      INSERT INTO dbo.ResourceBookTopics (resource_book_id, name)
      OUTPUT inserted.id
      VALUES (@resourceBookId, @name);
    `)
  return result.recordset[0].id
}

async function insertTest(pool, topicId, topicName, name, pageStart, pageEnd, questionCount) {
  const pageCount = pageEnd - pageStart + 1
  await pool
    .request()
    .input('topicId', sql.UniqueIdentifier, topicId)
    .input('topicName', sql.NVarChar(200), topicName)
    .input('name', sql.NVarChar(200), name)
    .input('pageStart', sql.Int, pageStart)
    .input('pageEnd', sql.Int, pageEnd)
    .input('pageCount', sql.Int, pageCount)
    .input('questionCount', sql.Int, questionCount).query(`
      INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_start, page_end, page_count, question_count)
      VALUES (@topicId, @topicName, @name, @pageStart, @pageEnd, @pageCount, @questionCount);
    `)
}

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(connectionString)

  try {
    const publisherId = await getPublisherId(pool)
    console.log(`Publisher: ${PUBLISHER_NAME} -> ${publisherId}`)

    const subjectId = await getSubjectId(pool)
    console.log(`Subject: ${SUBJECT_NAME} -> ${subjectId}`)

    const resourceBookId = await getOrCreateResourceBook(pool, publisherId, subjectId)
    console.log(`ResourceBook: ${BOOK_NAME} -> ${resourceBookId}`)

    const existingTopics = await pool
      .request()
      .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
      .query('SELECT name FROM dbo.ResourceBookTopics WHERE resource_book_id = @resourceBookId;')
    const existingNames = new Set(existingTopics.recordset.map((r) => r.name))

    let created = 0
    for (const deneme of DENEMELER) {
      if (existingNames.has(deneme.topicLabel)) {
        console.log(`Skip (already exists): ${deneme.topicLabel}`)
        continue
      }

      const { pageStart, pageEnd } = pageRangeFor(deneme.no)
      const topicId = await insertTopic(pool, resourceBookId, deneme.topicLabel)
      await insertTest(
        pool,
        topicId,
        deneme.topicLabel,
        `Deneme ${deneme.no}`,
        pageStart,
        pageEnd,
        QUESTIONS_PER_DENEME,
      )
      created += 1
      console.log(`${deneme.topicLabel}: Deneme ${deneme.no}, sayfa ${pageStart}-${pageEnd}`)
    }

    console.log(`Done. Yeni İçerik/Test: ${created}`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
