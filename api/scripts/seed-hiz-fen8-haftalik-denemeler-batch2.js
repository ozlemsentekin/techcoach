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
const BOOK_NAME = '8. Sınıf Fen Bilimleri 36 Haftalık Kazanım Denemeleri'
const QUESTIONS_PER_DENEME = 20
const PAGES_PER_DENEME = 8
const FIRST_PAGE = 2 // page 1 is the book's cover/title page, not part of any deneme

// Continuing from batch 1 (Deneme 1-23). Read directly off each deneme's own hafta/ünite/tatil
// header page (18.HAFTA ... 36.HAFTA, plus the 4./5./6./7. Ünite Değerlendirme and 2. Ara Tatil
// Değerlendirme pages).
const DENEMELER = [
  { no: 24, topicLabel: '18. Hafta - Maddenin Isı ile Etkileşimi' },
  { no: 25, topicLabel: '19. Hafta - Maddenin Isı ile Etkileşimi' },
  { no: 26, topicLabel: "20. Hafta - Türkiye'de Kimya Endüstrisi" },
  { no: 27, topicLabel: '4. Ünite Değerlendirme' },
  { no: 28, topicLabel: '21. Hafta - Basit Makineler (Makaralar)' },
  { no: 29, topicLabel: '22. Hafta - Basit Makineler (Kaldıraçlar)' },
  { no: 30, topicLabel: '23. Hafta - Basit Makineler (Eğik Düzlem ve Çıkrık)' },
  { no: 31, topicLabel: '24. Hafta - Basit Makineler (Vida, Dişli Çarklar ve Kasnaklar)' },
  { no: 32, topicLabel: '25. Hafta - Basit Makineler (Bileşik Makineler)' },
  { no: 33, topicLabel: '5. Ünite Değerlendirme' },
  { no: 34, topicLabel: '26. Hafta - Besin Zinciri ve Enerji Akışı' },
  { no: 35, topicLabel: '27. Hafta - Enerji Dönüşümleri (Fotosentez)' },
  { no: 36, topicLabel: '2. Ara Tatil Değerlendirme' },
  { no: 37, topicLabel: '28. Hafta - Enerji Dönüşümleri (Solunum)' },
  { no: 38, topicLabel: '29. Hafta - Madde Döngüleri ve Çevre Sorunları' },
  { no: 39, topicLabel: '30. Hafta - Madde Döngüleri ve Çevre Sorunları' },
  { no: 40, topicLabel: '31. Hafta - Sürdürülebilir Kalkınma' },
  { no: 41, topicLabel: '6. Ünite Değerlendirme' },
  { no: 42, topicLabel: '32. Hafta - Elektrik Yükleri ve Elektriklenme' },
  { no: 43, topicLabel: '33. Hafta - Elektrik Yükleri ve Elektriklenme' },
  { no: 44, topicLabel: '34. Hafta - Elektrik Yüklü Cisimler' },
  { no: 45, topicLabel: '35. Hafta - Elektrik Yüklü Cisimler' },
  { no: 46, topicLabel: '36. Hafta - Elektrik Enerjisinin Dönüşümü' },
  { no: 47, topicLabel: '7. Ünite Değerlendirme' },
]

// Transcribed from the book's own "Yanıt Anahtarı" summary page, Deneme 24 - Deneme 47.
const ANSWER_KEYS = {
  24: 'CADACBDDBDACCBCDDDBA',
  25: 'CDBDACCADBACCBCDDDCD',
  26: 'CCDABDABCADCADCDDDBC',
  27: 'CBACBDBAADDBDADDCABC',
  28: 'BCBABDAACDDBBADACDAB',
  29: 'ADBAACCCCCDDBCDADCAB',
  30: 'DACBADBDCCDDCDCCDDBA',
  31: 'ABDACDCDDABCBADCBDDA',
  32: 'CBDADCADDBAACBDBDDCB',
  33: 'DDCADBACBDCBBCDACABA',
  34: 'BDACBDCDDAAAAACCDCCD',
  35: 'CADDCCDABDDBADABBCCD',
  36: 'ABBCDDADAABBABDCDCDC',
  37: 'DDCBDBCBACDDCDCBDADB',
  38: 'DBDCCCABADCDCDCBADCA',
  39: 'CADCBABCADDCDCCADDAC',
  40: 'DAACDCDCDBADBADBCADC',
  41: 'DCCBBAABCCBDDDDADCDC',
  42: 'DDBCABCDAACCDDDBCCDD',
  43: 'AABDCDDCBDBBCCDBADDC',
  44: 'CACDCDDCBDDADACBDADC',
  45: 'CDBDABADADDCADCDBADC',
  46: 'DDACDBACDBCDDDDADCBD',
  47: 'CBCCABCBDABDCBADCCBA',
}

function pageRangeFor(no) {
  const pageStart = FIRST_PAGE + (no - 1) * PAGES_PER_DENEME
  const pageEnd = pageStart + PAGES_PER_DENEME - 1
  return { pageStart, pageEnd }
}

async function getResourceBookId(pool) {
  const result = await pool
    .request()
    .input('publisherName', sql.NVarChar(150), PUBLISHER_NAME)
    .input('bookName', sql.NVarChar(200), BOOK_NAME).query(`
      SELECT rb.id FROM dbo.ResourceBooks rb
      INNER JOIN dbo.Publishers p ON p.id = rb.publisher_id
      WHERE p.name = @publisherName AND rb.name = @bookName;
    `)
  if (!result.recordset.length) throw new Error('ResourceBook not found')
  return result.recordset[0].id
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
  const result = await pool
    .request()
    .input('topicId', sql.UniqueIdentifier, topicId)
    .input('topicName', sql.NVarChar(200), topicName)
    .input('name', sql.NVarChar(200), name)
    .input('pageStart', sql.Int, pageStart)
    .input('pageEnd', sql.Int, pageEnd)
    .input('pageCount', sql.Int, pageCount)
    .input('questionCount', sql.Int, questionCount).query(`
      INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_start, page_end, page_count, question_count)
      OUTPUT inserted.id
      VALUES (@topicId, @topicName, @name, @pageStart, @pageEnd, @pageCount, @questionCount);
    `)
  return result.recordset[0].id
}

async function insertAnswerKey(pool, testId, answers) {
  const letters = answers.split('')
  const values = []
  const request = pool.request().input('testId', sql.UniqueIdentifier, testId)
  letters.forEach((label, idx) => {
    const orderParam = `order${idx}`
    const labelParam = `label${idx}`
    request.input(orderParam, sql.Int, idx + 1)
    request.input(labelParam, sql.NChar(1), label)
    values.push(`(@testId, @${orderParam}, @${labelParam})`)
  })
  await request.query(`
    INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label)
    VALUES ${values.join(', ')};
  `)
}

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  for (const deneme of DENEMELER) {
    const answers = ANSWER_KEYS[deneme.no]
    if (!answers || answers.length !== 20) {
      throw new Error(`Deneme ${deneme.no}: expected 20 answers, got ${answers ? answers.length : 0}`)
    }
  }

  const pool = await sql.connect(connectionString)

  try {
    const resourceBookId = await getResourceBookId(pool)
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
      const testId = await insertTest(
        pool,
        topicId,
        deneme.topicLabel,
        `Deneme ${deneme.no}`,
        pageStart,
        pageEnd,
        QUESTIONS_PER_DENEME,
      )
      await insertAnswerKey(pool, testId, ANSWER_KEYS[deneme.no])
      created += 1
      console.log(`${deneme.topicLabel}: Deneme ${deneme.no}, sayfa ${pageStart}-${pageEnd}, 20 cevap eklendi`)
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
