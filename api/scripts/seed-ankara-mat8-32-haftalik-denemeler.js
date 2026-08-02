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

const PUBLISHER_NAME = 'Ankara Yayıncılık'
const SUBJECT_NAME = 'Matematik'
const BOOK_NAME = 'Güçlendiren 32 Haftalık Kazanım Denemeleri Matematik'
const BOOK_PAGE_COUNT = 264
const QUESTIONS_PER_DENEME = 20
// Each deneme is its own independently-paginated 8-page booklet (page 1-8 every time).
const PAGE_START = 1
const PAGE_END = 8

const DENEMELER = [
  { no: 1, topicLabel: '01. Hafta - Pozitif Tam Sayıların Pozitif Tam Sayı Çarpanları' },
  { no: 2, topicLabel: '02. Hafta - En Büyük Ortak Bölen (EBOB), En Küçük Ortak Kat (EKOK)' },
  { no: 3, topicLabel: '03. Hafta - Aralarında Asal Sayılar' },
  { no: 4, topicLabel: '04. Hafta - Tam Sayıların Tam Sayı Kuvvetleri, Üslü İfadelerle İlgili Temel Kurallar' },
  { no: 5, topicLabel: '05. Hafta - Üslü İfadelerle İlgili Temel Kurallar, Ondalık Gösterimlerin Bilimsel Gösterimi' },
  { no: 6, topicLabel: "06. Hafta - 10'un Kuvvetleri - Bilimsel Gösterim" },
  { no: 7, topicLabel: '07. Hafta - Tam Kare Sayılar, Tam Kare Olmayan Sayıların Değer Aralıkları' },
  { no: 8, topicLabel: '08. Hafta - a√b Şeklindeki İfadeler' },
  { no: 9, topicLabel: '09. Hafta - Kareköklü İfadeler ile Çarpma ve Bölme İşlemleri' },
  { no: 10, topicLabel: '10. Hafta - Kareköklü İfadeler ile Toplama ve Çıkarma İşlemleri' },
  { no: 11, topicLabel: '11. Hafta - Ondalık Gösterimlerin Karekökü - Gerçek Sayılar' },
  { no: 12, topicLabel: '12. Hafta - Çizgi, Sütun ve Daire Grafiklerini Yorumlama, Grafikler Arası Dönüşümler - I' },
  { no: 13, topicLabel: '13. Hafta - Çizgi, Sütun ve Daire Grafiklerini Yorumlama, Grafikler Arası Dönüşümler - II' },
  { no: 14, topicLabel: '14. Hafta - Olasılık Kavramları' },
  { no: 15, topicLabel: '15. Hafta - Olasılık Değeri' },
  { no: 16, topicLabel: '16. Hafta - Cebirsel İfadelerle Çarpma İşlemi' },
  { no: 17, topicLabel: '17. Hafta - Özdeşlikler' },
  { no: 18, topicLabel: '18. Hafta - Cebirsel İfadeleri Çarpanlara Ayırma' },
  { no: 19, topicLabel: '19. Hafta - Birinci Dereceden Bir Bilinmeyenli Denklemler' },
  { no: 20, topicLabel: '20. Hafta - Koordinat Sistemi' },
  { no: 21, topicLabel: '21. Hafta - Doğru Grafikleri' },
  { no: 22, topicLabel: '22. Hafta - Doğrusal İlişki' },
  { no: 23, topicLabel: '23. Hafta - Eğim' },
  { no: 24, topicLabel: '24. Hafta - Eşitsizlik Yazma ve Sayı Doğrusunda Gösterme' },
  { no: 25, topicLabel: '25. Hafta - Eşitsizlik Çözme' },
  { no: 26, topicLabel: '26. Hafta - Üçgende Yardımcı Doğrular - Üçgen Eşitsizliği' },
  { no: 27, topicLabel: '27. Hafta - Üçgende Açı-Kenar Bağıntıları - Üçgen Çizimi' },
  { no: 28, topicLabel: '28. Hafta - Pisagor Bağıntısı' },
  { no: 29, topicLabel: '29. Hafta - Eşlik ve Benzerlik' },
  { no: 30, topicLabel: '30. Hafta - Öteleme - Yansıma - Ötelemeli Yansıma' },
  { no: 31, topicLabel: '31. Hafta - Prizmaların ve Silindirlerin Temel Özellikleri' },
  { no: 32, topicLabel: '32. Hafta - Silindirin Alanı ve Hacmi' },
]

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

      const topicId = await insertTopic(pool, resourceBookId, deneme.topicLabel)
      await insertTest(
        pool,
        topicId,
        deneme.topicLabel,
        `Deneme ${deneme.no}`,
        PAGE_START,
        PAGE_END,
        QUESTIONS_PER_DENEME,
      )
      created += 1
      console.log(`${deneme.topicLabel}: Deneme ${deneme.no}, sayfa ${PAGE_START}-${PAGE_END}`)
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
