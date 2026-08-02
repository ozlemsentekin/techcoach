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

const PUBLISHER_NAME = 'Günay Yayınları'
const SUBJECT_NAME = 'Fen Bilimleri'
const BOOK_NAME = 'Bumerang Serisi Fen Bilimleri'
const BOOK_PAGE_COUNT = 448
const QUESTIONS_PER_PAGE = 4 // book owner's own rule of thumb (8 soru = 2 sayfa, 12 soru = 3 sayfa)

// Page numbers come directly from the book's own İçindekiler — every Kavratan/Bumerang/Beceri
// Temelli test is individually listed with its own start page, so page_end = next listed item's
// page - 1. "Etkinlikler" sections are deliberately excluded: they aren't multiple-choice tests
// and don't fit the answer-key structure. question_count is ESTIMATED from page span
// (pageCount * 4) — the answer-key grids were not reliably transcribed this round, so no
// TestAnswerKeys are inserted; has_answer_key is left false until that follow-up pass.
// Ünite (İçerik) names match the master grouping already used for this publisher's ZOOM Serisi
// book, so both resources line up under the same content-group structure.
const UNITELER = [
  {
    name: '1. Ünite - Mevsimler ve İklim',
    tests: [
      ['Kavratan Test-1', 'Mevsimlerin Oluşumu', 19, 21],
      ['Kavratan Test-2', 'Mevsimlerin Oluşumu', 22, 24],
      ['Bumerang Test-1', 'Mevsimlerin Oluşumu', 25, 26],
      ['Kavratan Test-3', 'İklim ve Hava Hareketleri', 37, 39],
      ['Kavratan Test-4', 'İklim ve Hava Hareketleri', 40, 42],
      ['Bumerang Test-2', 'İklim ve Hava Hareketleri', 43, 44],
      ['Beceri Temelli Test-1', '1. Ünite - Mevsimler ve İklim', 45, 48],
      ['Beceri Temelli Test-2', '1. Ünite - Mevsimler ve İklim', 49, 52],
    ],
  },
  {
    name: '2. Ünite - DNA ve Genetik Kod',
    tests: [
      ['Kavratan Test-1', 'DNA ve Genetik Kod', 61, 63],
      ['Kavratan Test-2', 'DNA ve Genetik Kod', 64, 66],
      ['Bumerang Test-1', 'DNA ve Genetik Kod', 67, 68],
      ['Kavratan Test-3', 'Kalıtım', 77, 79],
      ['Kavratan Test-4', 'Kalıtım', 80, 82],
      ['Bumerang Test-2', 'Kalıtım', 83, 84],
      ['Kavratan Test-5', 'Mutasyon ve Modifikasyon', 89, 91],
      ['Kavratan Test-6', 'Mutasyon ve Modifikasyon', 92, 94],
      ['Bumerang Test-3', 'Mutasyon ve Modifikasyon', 95, 96],
      ['Kavratan Test-7', 'Adaptasyon (Çevreye Uyum)', 101, 103],
      ['Kavratan Test-8', 'Adaptasyon (Çevreye Uyum)', 104, 106],
      ['Bumerang Test-4', 'Adaptasyon (Çevreye Uyum)', 107, 108],
      ['Kavratan Test-9', 'Biyoteknoloji', 117, 119],
      ['Kavratan Test-10', 'Biyoteknoloji', 120, 122],
      ['Bumerang Test-5', 'Biyoteknoloji', 123, 124],
      ['Beceri Temelli Test-1', '2. Ünite - DNA ve Genetik Kod', 125, 128],
      ['Beceri Temelli Test-2', '2. Ünite - DNA ve Genetik Kod', 129, 132],
    ],
  },
  {
    name: '3. Ünite - Basınç',
    tests: [
      ['Kavratan Test-1', 'Katı Basıncı', 141, 143],
      ['Kavratan Test-2', 'Katı Basıncı', 144, 146],
      ['Bumerang Test-1', 'Katı Basıncı', 147, 148],
      ['Kavratan Test-3', 'Sıvı Basıncı', 155, 157],
      ['Kavratan Test-4', 'Sıvı Basıncı', 158, 160],
      ['Bumerang Test-2', 'Sıvı Basıncı', 161, 162],
      ['Kavratan Test-5', 'Gaz Basıncı ve Basıncın Günlük Hayattaki Uygulamaları', 173, 175],
      ['Kavratan Test-6', 'Gaz Basıncı ve Basıncın Günlük Hayattaki Uygulamaları', 176, 178],
      ['Bumerang Test-3', 'Gaz Basıncı ve Basıncın Günlük Hayattaki Uygulamaları', 179, 180],
      ['Beceri Temelli Test-1', '3. Ünite - Basınç', 181, 184],
      ['Beceri Temelli Test-2', '3. Ünite - Basınç', 185, 188],
    ],
  },
  {
    name: '4. Ünite - Madde ve Endüstri',
    tests: [
      ['Kavratan Test-1', 'Periyodik Sistem', 197, 199],
      ['Kavratan Test-2', 'Periyodik Sistem', 200, 202],
      ['Bumerang Test-1', 'Periyodik Sistem', 203, 204],
      ['Kavratan Test-3', 'Fiziksel ve Kimyasal Değişimler', 209, 211],
      ['Kavratan Test-4', 'Fiziksel ve Kimyasal Değişimler', 212, 214],
      ['Bumerang Test-2', 'Fiziksel ve Kimyasal Değişimler', 215, 216],
      ['Kavratan Test-5', 'Kimyasal Tepkimeler', 221, 223],
      ['Kavratan Test-6', 'Kimyasal Tepkimeler', 224, 226],
      ['Bumerang Test-3', 'Kimyasal Tepkimeler', 227, 228],
      ['Kavratan Test-7', 'Asit ve Bazlar', 237, 239],
      ['Kavratan Test-8', 'Asit ve Bazlar', 240, 242],
      ['Bumerang Test-4', 'Asit ve Bazlar', 243, 244],
      ['Kavratan Test-9', 'Maddenin Isı ile Etkileşimi', 257, 259],
      ['Kavratan Test-10', 'Maddenin Isı ile Etkileşimi', 260, 262],
      ['Bumerang Test-5', 'Maddenin Isı ile Etkileşimi', 263, 264],
      ['Kavratan Test-11', "Türkiye'de Kimya Endüstrisi", 269, 270],
      ['Kavratan Test-12', "Türkiye'de Kimya Endüstrisi", 271, 272],
      ['Bumerang Test-6', "Türkiye'de Kimya Endüstrisi", 273, 274],
      ['Beceri Temelli Test-1', '4. Ünite - Madde ve Endüstri', 275, 278],
      ['Beceri Temelli Test-2', '4. Ünite - Madde ve Endüstri', 279, 282],
    ],
  },
  {
    name: '5. Ünite - Basit Makineler',
    tests: [
      ['Kavratan Test-1', 'Kaldıraçlar', 295, 296],
      ['Bumerang Test-1', 'Kaldıraçlar', 297, 300],
      ['Kavratan Test-2', 'Makaralar', 309, 310],
      ['Bumerang Test-2', 'Makaralar', 311, 312],
      ['Kavratan Test-3', 'Eğik Düzlem', 319, 319],
      ['Bumerang Test-3', 'Eğik Düzlem', 320, 320],
      ['Kavratan Test-4', 'Çıkrık, Dişli Çark, Kasnak, Vida, Kama, Bileşik Makineler', 325, 328],
      ['Bumerang Test-4', 'Çıkrık, Dişli Çark, Kasnak, Vida, Kama, Bileşik Makineler', 329, 330],
      ['Beceri Temelli Test-1', '5. Ünite - Basit Makineler', 331, 334],
      ['Beceri Temelli Test-2', '5. Ünite - Basit Makineler', 335, 338],
    ],
  },
  {
    name: '6. Ünite - Enerji Dönüşümleri ve Çevre Bilimi',
    tests: [
      ['Kavratan Test-1', 'Besin Zinciri ve Enerji Akışı', 345, 347],
      ['Kavratan Test-2', 'Besin Zinciri ve Enerji Akışı', 348, 350],
      ['Bumerang Test-1', 'Besin Zinciri ve Enerji Akışı', 351, 352],
      ['Kavratan Test-3', 'Enerji Dönüşümleri', 363, 365],
      ['Kavratan Test-4', 'Enerji Dönüşümleri', 366, 368],
      ['Bumerang Test-2', 'Enerji Dönüşümleri', 369, 370],
      ['Kavratan Test-5', 'Madde Döngüleri', 375, 377],
      ['Kavratan Test-6', 'Madde Döngüleri', 378, 380],
      ['Bumerang Test-3', 'Madde Döngüleri', 381, 382],
      ['Kavratan Test-7', 'Sürdürülebilir Kalkınma', 385, 386],
      ['Bumerang Test-4', 'Sürdürülebilir Kalkınma', 387, 388],
      ['Beceri Temelli Test-1', '6. Ünite - Enerji Dönüşümleri ve Çevre Bilimi', 389, 392],
      ['Beceri Temelli Test-2', '6. Ünite - Enerji Dönüşümleri ve Çevre Bilimi', 393, 396],
    ],
  },
  {
    name: '7. Ünite - Elektrik Yükleri ve Elektrik Enerjisi',
    tests: [
      ['Kavratan Test-1', 'Elektrik Yükleri ve Elektriklenme, Elektrik Yüklü Cisimler', 409, 411],
      ['Kavratan Test-2', 'Elektrik Yükleri ve Elektriklenme, Elektrik Yüklü Cisimler', 412, 414],
      ['Bumerang Test-1', 'Elektrik Yükleri ve Elektriklenme, Elektrik Yüklü Cisimler', 415, 416],
      ['Kavratan Test-3', 'Elektrik Enerjisinin Dönüşümü', 425, 427],
      ['Kavratan Test-4', 'Elektrik Enerjisinin Dönüşümü', 428, 430],
      ['Bumerang Test-2', 'Elektrik Enerjisinin Dönüşümü', 431, 432],
      ['Beceri Temelli Test-1', '7. Ünite - Elektrik Yükleri ve Elektrik Enerjisi', 433, 436],
      ['Beceri Temelli Test-2', '7. Ünite - Elektrik Yükleri ve Elektrik Enerjisi', 437, 440],
    ],
  },
]

async function getOrCreatePublisher(pool) {
  const existing = await pool
    .request()
    .input('name', sql.NVarChar(150), PUBLISHER_NAME)
    .query('SELECT id FROM dbo.Publishers WHERE name = @name;')
  if (existing.recordset.length) return existing.recordset[0].id
  const inserted = await pool
    .request()
    .input('name', sql.NVarChar(150), PUBLISHER_NAME)
    .query('INSERT INTO dbo.Publishers (name) OUTPUT inserted.id VALUES (@name);')
  return inserted.recordset[0].id
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
  if (existing.recordset.length) return { id: existing.recordset[0].id, isNew: false }

  const inserted = await pool
    .request()
    .input('publisherId', sql.UniqueIdentifier, publisherId)
    .input('subjectId', sql.UniqueIdentifier, subjectId)
    .input('name', sql.NVarChar(200), BOOK_NAME)
    .input('pageCount', sql.Int, BOOK_PAGE_COUNT)
    .input('isActive', sql.Bit, true)
    .input('resourceType', sql.NVarChar(30), 'soru_bankasi')
    .input('hasAnswerKey', sql.Bit, false).query(`
      INSERT INTO dbo.ResourceBooks (publisher_id, subject_id, name, page_count, is_active, resource_type, has_answer_key)
      OUTPUT inserted.id
      VALUES (@publisherId, @subjectId, @name, @pageCount, @isActive, @resourceType, @hasAnswerKey);
    `)
  return { id: inserted.recordset[0].id, isNew: true }
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
    const publisherId = await getOrCreatePublisher(pool)
    console.log(`Publisher: ${PUBLISHER_NAME} -> ${publisherId}`)

    const subjectId = await getSubjectId(pool)
    console.log(`Subject: ${SUBJECT_NAME} -> ${subjectId}`)

    const { id: resourceBookId, isNew } = await getOrCreateResourceBook(pool, publisherId, subjectId)
    console.log(`ResourceBook: ${BOOK_NAME} -> ${resourceBookId} (${isNew ? 'created' : 'existing'})`)

    if (!isNew) {
      const existingTopics = await pool
        .request()
        .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
        .query('SELECT COUNT(*) AS cnt FROM dbo.ResourceBookTopics WHERE resource_book_id = @resourceBookId;')
      if (existingTopics.recordset[0].cnt > 0) {
        console.log('ResourceBook already has topics — skipping to avoid duplicates.')
        return
      }
    }

    let totalTests = 0

    for (const unite of UNITELER) {
      const topicId = await insertTopic(pool, resourceBookId, unite.name)
      for (const [name, topicName, pageStart, pageEnd] of unite.tests) {
        const pages = pageEnd - pageStart + 1
        const questionCount = Math.max(1, pages * QUESTIONS_PER_PAGE)
        await insertTest(pool, topicId, topicName, name, pageStart, pageEnd, questionCount)
        totalTests += 1
      }
      console.log(`İçerik "${unite.name}": ${unite.tests.length} test`)
    }

    console.log(`\nDone. İçerik: ${UNITELER.length}, Test: ${totalTests} (cevap anahtarı henüz eklenmedi)`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
