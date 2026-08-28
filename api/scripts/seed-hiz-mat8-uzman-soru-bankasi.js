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
const BOOK_NAME = '8. Sınıf Matematik Uzman Soru Bankası 2026'

// İçindekiler'den birebir. Her ünitede iki konu, her konunun ardından bir de
// "Çıkmış Sınav Soruları" bölümü var. Konu bölümlerindeki testler kitapta 2'şer sayfa
// (sayfa aralıkları birebir tutuyor), "Çıkmış Sınav Soruları" bölümü tek büyük test.
// Test numaraları ve soru sayıları basılı "Matematik Uzmanı Yanıt Anahtarı"ndan (s.255).
// Hız Yayınları konvansiyonu: her ünite tek bir ResourceBookTopics satırı,
// test'in topic_name alanı alt bölüm (konu) adını tutar.
const UNITE_NAMES = {
  1: '1. Ünite - Çarpanlar ve Katlar, Üslü İfadeler',
  2: '2. Ünite - Kareköklü İfadeler, Veri Analizi',
  3: '3. Ünite - Basit Olayların Olma Olasılığı, Cebirsel İfadeler ve Özdeşlikler',
  4: '4. Ünite - Doğrusal Denklemler, Eşitsizlikler',
  5: '5. Ünite - Üçgenler, Eşlik ve Benzerlik',
  6: '6. Ünite - Dönüşüm Geometrisi, Geometrik Cisimler',
}

// name, unite, start (bölümün başladığı sayfa), testCount, cikmis?
const SECTIONS = [
  { name: 'Çarpanlar ve Katlar', unite: 1, start: 7, testCount: 7 },
  { name: 'Çarpanlar ve Katlar Çıkmış Sınav Soruları', unite: 1, start: 21, testCount: 1, cikmis: true },
  { name: 'Üslü İfadeler', unite: 1, start: 27, testCount: 7 },
  { name: 'Üslü İfadeler Çıkmış Sınav Soruları', unite: 1, start: 41, testCount: 1, cikmis: true },

  { name: 'Kareköklü İfadeler', unite: 2, start: 48, testCount: 11 },
  { name: 'Kareköklü İfadeler Çıkmış Sınav Soruları', unite: 2, start: 70, testCount: 1, cikmis: true },
  { name: 'Veri Analizi', unite: 2, start: 82, testCount: 4 },
  { name: 'Veri Analizi Çıkmış Sınav Soruları', unite: 2, start: 90, testCount: 1, cikmis: true },

  { name: 'Basit Olayların Olma Olasılığı', unite: 3, start: 97, testCount: 6 },
  { name: 'Basit Olayların Olma Olasılığı Çıkmış Sınav Soruları', unite: 3, start: 109, testCount: 1, cikmis: true },
  { name: 'Cebirsel İfadeler ve Özdeşlikler', unite: 3, start: 115, testCount: 7 },
  { name: 'Cebirsel İfadeler ve Özdeşlikler Çıkmış Sınav Soruları', unite: 3, start: 129, testCount: 1, cikmis: true },

  { name: 'Doğrusal Denklemler', unite: 4, start: 137, testCount: 12 },
  { name: 'Doğrusal Denklemler Çıkmış Sınav Soruları', unite: 4, start: 161, testCount: 1, cikmis: true },
  { name: 'Eşitsizlikler', unite: 4, start: 168, testCount: 5 },
  { name: 'Eşitsizlikler Çıkmış Sınav Soruları', unite: 4, start: 178, testCount: 1, cikmis: true },

  { name: 'Üçgenler', unite: 5, start: 183, testCount: 7 },
  { name: 'Üçgenler Çıkmış Sınav Soruları', unite: 5, start: 197, testCount: 1, cikmis: true },
  { name: 'Eşlik ve Benzerlik', unite: 5, start: 208, testCount: 5 },
  { name: 'Eşlik ve Benzerlik Çıkmış Sınav Soruları', unite: 5, start: 218, testCount: 1, cikmis: true },

  { name: 'Dönüşüm Geometrisi', unite: 6, start: 222, testCount: 4 },
  { name: 'Dönüşüm Geometrisi Çıkmış Sınav Soruları', unite: 6, start: 230, testCount: 1, cikmis: true },
  { name: 'Geometrik Cisimler', unite: 6, start: 234, testCount: 8 },
  { name: 'Geometrik Cisimler Çıkmış Sınav Soruları', unite: 6, start: 250, testCount: 1, cikmis: true },

  // sentinel: Matematik Uzmanı Yanıt Anahtarı s.255'te başlıyor
  { name: '__END__', start: 255 },
]

// Test no -> cevap dizisi (basılı yanıt anahtarından). Soru sayısı dizinin uzunluğu.
const ANSWER_KEYS = {
  1: 'CCBA', 2: 'ACDA', 3: 'DCCC', 4: 'DABD', 5: 'BCBB', 6: 'ACCC', 7: 'DCBB',
  8: 'CCACCBBCBBCACB',
  9: 'ACDC', 10: 'CABB', 11: 'ACBD', 12: 'DBCA', 13: 'BDAA', 14: 'CBBC', 15: 'ACCD',
  16: 'CABBCDBBACAADDCCBCB',
  17: 'BDDC', 18: 'ABBD', 19: 'DBCB', 20: 'ACAD', 21: 'AABD', 22: 'DCAC', 23: 'CCBC',
  24: 'CCCB', 25: 'BDAA', 26: 'ABCC', 27: 'BBAC',
  28: 'BBDDCDBCDCBDBDBBBDCDBCABDBC',
  29: 'BACAC', 30: 'AADD', 31: 'ADCD', 32: 'DCCD',
  33: 'ADADBCDDCA',
  34: 'CBBC', 35: 'BDCA', 36: 'DCDB', 37: 'ADCB', 38: 'DBAC', 39: 'CDAA',
  40: 'CBCCBBCCBABA',
  41: 'ADBD', 42: 'BACA', 43: 'DCBC', 44: 'BCDD', 45: 'BCDD', 46: 'BDCC', 47: 'DDAB',
  48: 'DABAADBBADCCBADADD',
  49: 'DBBB', 50: 'BCCD', 51: 'CBAB', 52: 'CBBB', 53: 'AADB', 54: 'DCCB', 55: 'ABDC',
  56: 'DDBB', 57: 'DCBB', 58: 'BDDA', 59: 'ADDC', 60: 'DCC',
  61: 'CADABDABCBABBBDC',
  62: 'DBAC', 63: 'ABDA', 64: 'CDCB', 65: 'DCAB', 66: 'CACD',
  67: 'DCBADDCBACA',
  68: 'ACCD', 69: 'DABB', 70: 'ADAC', 71: 'CCC', 72: 'ABBB', 73: 'BCBC', 74: 'CDDB',
  75: 'CACADAACBDDCBD',
  76: 'BCDC', 77: 'BDBA', 78: 'CCDD', 79: 'CDDC', 80: 'ADCD',
  81: 'BBACCC',
  82: 'CDD', 83: 'CAAB', 84: 'BCCC', 85: 'ADDB',
  86: 'CBADA',
  87: 'CCAC', 88: 'BBCB', 89: 'BBC', 90: 'BCBA', 91: 'CACD', 92: 'ADAB', 93: 'ABBD', 94: 'ABBB',
  95: 'CDDACDB',
}

const TOTAL_TESTS = 95

function buildTopics() {
  const topics = []
  let testNo = 1

  for (let i = 0; i < SECTIONS.length - 1; i += 1) {
    const section = SECTIONS[i]
    const nextStart = SECTIONS[i + 1].start
    const tests = []

    if (section.cikmis) {
      // Tek büyük test, bölümün tüm sayfa aralığını kaplar.
      const answers = ANSWER_KEYS[testNo]
      if (!answers) throw new Error(`Test ${testNo} için cevap anahtarı yok`)
      tests.push({
        no: testNo,
        name: `Test ${testNo}`,
        pageStart: section.start,
        pageEnd: nextStart - 1,
        answers: answers.split(''),
      })
      testNo += 1
    } else {
      // Konu bölümü: her test 2 sayfa (kitapla birebir).
      const pageSpan = nextStart - section.start
      if (pageSpan !== section.testCount * 2) {
        throw new Error(
          `"${section.name}": ${section.testCount} test için ${section.testCount * 2} sayfa bekleniyordu, ` +
            `İçindekiler ${pageSpan} sayfa veriyor`,
        )
      }
      for (let t = 0; t < section.testCount; t += 1) {
        const answers = ANSWER_KEYS[testNo]
        if (!answers) throw new Error(`Test ${testNo} için cevap anahtarı yok`)
        const pageStart = section.start + t * 2
        tests.push({
          no: testNo,
          name: `Test ${testNo}`,
          pageStart,
          pageEnd: pageStart + 1,
          answers: answers.split(''),
        })
        testNo += 1
      }
    }

    topics.push({ subtopicName: section.name, unite: section.unite, tests })
  }

  return { topics, lastTestNo: testNo - 1 }
}

async function getResourceBookId(pool) {
  const result = await pool
    .request()
    .input('publisherName', sql.NVarChar(150), PUBLISHER_NAME)
    .input('bookName', sql.NVarChar(200), BOOK_NAME).query(`
      SELECT rb.id
      FROM dbo.ResourceBooks rb
      INNER JOIN dbo.Publishers p ON p.id = rb.publisher_id
      WHERE p.name = @publisherName AND rb.name = @bookName;
    `)
  if (!result.recordset.length) throw new Error(`ResourceBook bulunamadı: ${PUBLISHER_NAME} - ${BOOK_NAME}`)
  return result.recordset[0].id
}

async function getOrCreateTopic(pool, resourceBookId, name) {
  const existing = await pool
    .request()
    .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
    .input('name', sql.NVarChar(200), name)
    .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @resourceBookId AND name = @name;')
  if (existing.recordset.length) return existing.recordset[0].id

  const inserted = await pool
    .request()
    .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
    .input('name', sql.NVarChar(200), name).query(`
      INSERT INTO dbo.ResourceBookTopics (resource_book_id, name)
      OUTPUT inserted.id
      VALUES (@resourceBookId, @name);
    `)
  return inserted.recordset[0].id
}

async function testExists(pool, topicId, topicName, name) {
  const result = await pool
    .request()
    .input('topicId', sql.UniqueIdentifier, topicId)
    .input('topicName', sql.NVarChar(200), topicName)
    .input('name', sql.NVarChar(200), name)
    .query(
      'SELECT id FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId AND topic_name = @topicName AND name = @name;',
    )
  return result.recordset[0]?.id || null
}

async function insertTest(pool, topicId, topicName, test) {
  const pageCount = test.pageEnd - test.pageStart + 1
  const result = await pool
    .request()
    .input('topicId', sql.UniqueIdentifier, topicId)
    .input('topicName', sql.NVarChar(200), topicName)
    .input('name', sql.NVarChar(200), test.name)
    .input('pageStart', sql.Int, test.pageStart)
    .input('pageEnd', sql.Int, test.pageEnd)
    .input('pageCount', sql.Int, pageCount)
    .input('questionCount', sql.Int, test.answers.length).query(`
      INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_start, page_end, page_count, question_count)
      OUTPUT inserted.id
      VALUES (@topicId, @topicName, @name, @pageStart, @pageEnd, @pageCount, @questionCount);
    `)
  const testId = result.recordset[0].id

  const request = pool.request().input('testId', sql.UniqueIdentifier, testId)
  const values = []
  test.answers.forEach((label, idx) => {
    request.input(`order${idx}`, sql.Int, idx + 1)
    request.input(`label${idx}`, sql.NChar(1), label)
    values.push(`(@testId, @order${idx}, @label${idx})`)
  })
  await request.query(`
    INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label)
    VALUES ${values.join(', ')};
  `)

  console.log(`  + ${test.name} -> "${topicName}" (s.${test.pageStart}-${test.pageEnd}, ${test.answers.length} soru)`)
}

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING eksik.')

  const { topics, lastTestNo } = buildTopics()
  if (lastTestNo !== TOTAL_TESTS) {
    throw new Error(`Toplam ${TOTAL_TESTS} test bekleniyordu, ${lastTestNo} hesaplandı`)
  }

  const pool = await sql.connect(connectionString)
  try {
    const resourceBookId = await getResourceBookId(pool)
    console.log(`ResourceBook: ${BOOK_NAME} -> ${resourceBookId}`)

    const uniteTopicIds = {}
    for (const uniteNo of Object.keys(UNITE_NAMES)) {
      uniteTopicIds[uniteNo] = await getOrCreateTopic(pool, resourceBookId, UNITE_NAMES[uniteNo])
      console.log(`İçerik: ${UNITE_NAMES[uniteNo]} -> ${uniteTopicIds[uniteNo]}`)
    }

    let totalTests = 0
    let totalAnswers = 0
    let skipped = 0

    for (const topic of topics) {
      const uniteTopicId = uniteTopicIds[topic.unite]
      for (const test of topic.tests) {
        const existingId = await testExists(pool, uniteTopicId, topic.subtopicName, test.name)
        if (existingId) {
          console.log(`  = ${test.name} zaten var ("${topic.subtopicName}") — atlandı`)
          skipped += 1
          continue
        }
        await insertTest(pool, uniteTopicId, topic.subtopicName, test)
        totalTests += 1
        totalAnswers += test.answers.length
      }
    }

    console.log(
      `Bitti. Üniteler: ${Object.keys(UNITE_NAMES).length}, alt konular: ${topics.length}, ` +
        `eklenen test: ${totalTests}, cevap anahtarı satırı: ${totalAnswers}, atlanan: ${skipped}`,
    )
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed başarısız')
  console.error(error)
  process.exit(1)
})
