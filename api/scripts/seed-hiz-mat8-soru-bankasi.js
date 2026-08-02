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
const SUBJECT_NAME = 'Matematik'
const BOOK_NAME = '8. Sınıf Matematik Soru Bankası'
const BOOK_PAGE_COUNT = 294

// Derived from the table of contents. Each named section spans from its own start page up to
// (but not including) the next section's start page. "Değerlendirme Testi" repeats per ünite
// (twice per ünite here) so those are disambiguated with a (1)/(2) suffix.
// `unite` groups sections under the publisher-level Ünite content entry (same convention as the
// Fen Bilimleri book), matching standard MEB 8. sınıf matematik ünite gruplamaları.
const TOC_SECTIONS = [
  { name: 'Pozitif Tam Sayıların Çarpanları', start: 10, unite: 1 },
  { name: 'En Büyük Ortak Bölen - En Küçük Ortak Kat', start: 14, unite: 1 },
  { name: 'Aralarında Asal Sayılar', start: 20, unite: 1 },
  { name: '1. Ünite Değerlendirme Testi (1)', start: 22, unite: 1 },
  { name: 'Tam Sayıların Tam Sayı Kuvvetleri', start: 32, unite: 1 },
  { name: 'Üslü İfadelerde Temel Kurallar', start: 36, unite: 1 },
  { name: 'Ondalık Gösterimleri Çözümleme', start: 42, unite: 1 },
  { name: "Sayıları 10'un Kuvvetlerini Kullanarak Gösterme ve Bilimsel Gösterim", start: 44, unite: 1 },
  { name: '1. Ünite Değerlendirme Testi (2)', start: 48, unite: 1 },

  { name: 'Tam Kare Pozitif Tam Sayılar', start: 59, unite: 2 },
  { name: 'Tam Kare Pozitif Tam Sayıların Karekökü', start: 61, unite: 2 },
  { name: 'Tam Kare Olmayan Pozitif Tam Sayıların Karekökü', start: 63, unite: 2 },
  { name: 'Kareköklü İfadelerin Farklı Gösterimleri', start: 65, unite: 2 },
  { name: 'Kareköklü İfadelerde Çarpma ve Bölme İşlemleri', start: 67, unite: 2 },
  { name: 'Kareköklü İfadelerde Toplama ve Çıkarma İşlemleri', start: 73, unite: 2 },
  { name: 'Ondalık Gösterimlerin Kareköklü', start: 77, unite: 2 },
  { name: 'Gerçek Sayılar', start: 81, unite: 2 },
  { name: '2. Ünite Değerlendirme Testi (1)', start: 83, unite: 2 },
  { name: 'Veri Analizi', start: 95, unite: 2 },
  { name: '2. Ünite Değerlendirme Testi (2)', start: 101, unite: 2 },

  { name: 'Bir Olayın Olma Olasılığı', start: 108, unite: 3 },
  { name: '3. Ünite Değerlendirme Testi (1)', start: 116, unite: 3 },
  { name: 'Cebirsel İfadeler', start: 122, unite: 3 },
  { name: 'Özdeşlikler', start: 126, unite: 3 },
  { name: 'Cebirsel İfadeleri Çarpanlara Ayırma', start: 132, unite: 3 },
  { name: '3. Ünite Değerlendirme Testi (2)', start: 138, unite: 3 },

  { name: 'Birinci Dereceden Bir Bilinmeyenli Denklemler', start: 149, unite: 4 },
  { name: 'Koordinat Sistemi ve Sıralı İkililer', start: 157, unite: 4 },
  { name: 'Doğrusal İlişkiler', start: 161, unite: 4 },
  { name: 'Doğrusal Denklemlerin Grafiği', start: 163, unite: 4 },
  { name: 'Doğrunun Eğimi', start: 169, unite: 4 },
  { name: '4. Ünite Değerlendirme Testi (1)', start: 177, unite: 4 },
  { name: 'Birinci Dereceden Bir Bilinmeyenli Eşitsizlikler', start: 189, unite: 4 },
  { name: '4. Ünite Değerlendirme Testi (2)', start: 195, unite: 4 },

  { name: 'Üçgende Yardımcı Elemanlar', start: 200, unite: 5 },
  { name: 'Üçgenin Kenar Uzunlukları Arasındaki İlişkiler', start: 204, unite: 5 },
  { name: 'Üçgende Açı Kenar Bağıntıları', start: 208, unite: 5 },
  { name: 'Üçgen Çizimi', start: 212, unite: 5 },
  { name: 'Pisagor Bağıntısı', start: 214, unite: 5 },
  { name: '5. Ünite Değerlendirme Testi (1)', start: 222, unite: 5 },
  { name: 'Çokgenlerde Eşlik', start: 234, unite: 5 },
  { name: 'Çokgenlerde Benzerlik', start: 236, unite: 5 },
  { name: '5. Ünite Değerlendirme Testi (2)', start: 244, unite: 5 },

  { name: 'Öteleme', start: 251, unite: 6 },
  { name: 'Yansıma', start: 253, unite: 6 },
  { name: 'Ardışık Öteleme ve Yansıma', start: 255, unite: 6 },
  { name: '6. Ünite Değerlendirme Testi (1)', start: 257, unite: 6 },
  { name: 'Dik Prizmalar', start: 263, unite: 6 },
  { name: 'Dik Dairesel Silindir', start: 267, unite: 6 },
  { name: 'Dik Dairesel Silindirin Alanı', start: 269, unite: 6 },
  { name: 'Dik Dairesel Silindirin Hacmi', start: 273, unite: 6 },
  { name: 'Dik Piramit', start: 277, unite: 6 },
  { name: 'Dik Koni', start: 281, unite: 6 },
  { name: '6. Ünite Değerlendirme Testi (2)', start: 285, unite: 6 },

  // sentinel marking the end of content (Yanıt Anahtarı starts at 291)
  { name: '__END__', start: 291, unite: null },
]

const UNITE_NAMES = {
  1: '1. Ünite - Çarpanlar, Katlar ve Üslü İfadeler',
  2: '2. Ünite - Kareköklü İfadeler ve Veri Analizi',
  3: '3. Ünite - Olasılık, Cebirsel İfadeler ve Özdeşlikler',
  4: '4. Ünite - Doğrusal Denklemler ve Eşitsizlikler',
  5: '5. Ünite - Üçgenler, Eşlik ve Benzerlik',
  6: '6. Ünite - Dönüşüm Geometrisi ve Geometrik Cisimler',
}

// Answer key transcribed from the book's Yanıt Anahtarı pages (291-294), Test 1 - Test 138.
const ANSWER_KEYS = {
  1: 'CBDDBBBBACDBC', 2: 'BABCDBCDCCBCC', 3: 'BBDBDCBABCCDC', 4: 'CCCBACABABBB',
  5: 'ACBBCBADDABA', 6: 'BADCABCDCCACC', 7: 'ACABCDBDCA', 8: 'CDDABBCBA',
  9: 'DCBCBABAC', 10: 'ADBDACABC', 11: 'BBDCCCCB', 12: 'DACCBABDDCBDBB',
  13: 'CBBBDACCBCBD', 14: 'BBADCDCBCBBABC', 15: 'ADCCBDACDCBDBC', 16: 'CCBAADBACBCB',
  17: 'CAABCBCCC', 18: 'BCCBCDDBACCCCC', 19: 'DADBCBAABACC', 20: 'DCDACBBCCC',
  21: 'DCBACBCB', 22: 'CBACADACAA', 23: 'BBDBBCCBA', 24: 'CCDDDBCCAD',
  25: 'DCBDBCAACBADCC', 26: 'BCBBDDBDDBCCAA', 27: 'ACCBCACBDCCBB', 28: 'BDDDACCDDCBBA',
  29: 'CBCCDBCAACCD', 30: 'DBDBBCACAACB', 31: 'CDADCBADDABD', 32: 'CCACBDADCDAC',
  33: 'ACACDDCBADBC', 34: 'DBBDCBCBBBDCDC', 35: 'DBBDDABCBCCD',
  36: 'DCDCDCBDDCABC', 37: 'CCDABACBDD', 38: 'BDCACDAAB', 39: 'ACDDDBCBA',
  40: 'DCBDBCCBC', 41: 'DABCDCCBDA', 42: 'ADBABCADA', 43: 'BABDBCDCADBAD',
  44: 'ACDABCABAA', 45: 'DACBDBACBAD', 46: 'ACBBACDC', 47: 'BBADCB',
  48: 'DCDBBC', 49: 'DBDDCCDCCDA', 50: 'CCCCDDCACCB', 51: 'CDCBCADBCBBB',
  52: 'DDCCDBCDADC', 53: 'DDCCADDADC', 54: 'ACACABDBAD', 55: 'ACACCDDBC',
  56: 'DDDBCCACADCDA', 57: 'CBBCBDBCCBAA', 58: 'CBBDBACBDAA', 59: 'CCDDBDACDDDAB',
  60: 'CDADDDBDAADC', 61: 'ACBCDBABBDCD', 62: 'ABDDADBDADDA', 63: 'CCDCBDCBDCD',
  64: 'BDBADDDADC', 65: 'DCBDADAB', 66: 'DADCBACDD', 67: 'DDBAABBAC',
  68: 'BBDBACDCAD', 69: 'ABABDCBDCCDDA', 70: 'BCCACCCAACDD',
  71: 'CDCBADCCBCDD', 72: 'BBBADCDCACBC', 73: 'CCBBCBBDAA', 74: 'BDCCBBBCBD',
  75: 'ADBCABBBCCA', 76: 'ADBCABCBA', 77: 'CDCADCBBDCA', 78: 'ADACCCBC',
  79: 'AABDCBBBBC', 80: 'CCABDDBC', 81: 'CBDACBADBBDA', 82: 'ABAABDACC',
  83: 'BCBBBCBABB', 84: 'BBBCCBAD', 85: 'BCAADCAB', 86: 'CCCADABDA',
  87: 'CDBBAACDD', 88: 'CCDCACDC', 89: 'CDCADACDDBD', 90: 'CBCACADCADBB',
  91: 'CDACADCCBD', 92: 'CABCCADB', 93: 'ADBCCCCD', 94: 'CDCAACDB',
  95: 'ACBBCDDC', 96: 'CBCCAABCDCB', 97: 'ACACADDBBDC', 98: 'ABABCDCCBB',
  99: 'ADCADBADCB', 100: 'DBBDCDDBB', 101: 'BBACCAABBDD', 102: 'CCAACCBCCBC',
  103: 'BCCADBDACB', 104: 'CBCCDCBCBA', 105: 'DDCCCCAC',
  106: 'BBDBBBDC', 107: 'CBCBCDBA', 108: 'ACBBCBB', 109: 'CDDCCB',
  110: 'CBCABCD', 111: 'BBCBCDDAA', 112: 'BADDCACCCB', 113: 'ADCDCBACBC',
  114: 'ACCBDDBDB', 115: 'BABCBDDBC', 116: 'AACBAAAB', 117: 'ACCADABDA',
  118: 'BDDACCBD', 119: 'DDDACBBCB', 120: 'ABCABCBDD', 121: 'CCDCDDAB',
  122: 'ABABCBB', 123: 'CDABC', 124: 'CADCDBC', 125: 'CDDDCDBCB',
  126: 'CBBDADAACC', 127: 'BBDABDDC', 128: 'CCACADDB', 129: 'ADDBDDBBDBA',
  130: 'DBDBBDBCCC', 131: 'CACDCBDBAA', 132: 'DCACADCBCDBB', 133: 'CCACDCABB',
  134: 'BAADCBCC', 135: 'CACCBDDDB', 136: 'DAACBD', 137: 'ACCDBBBD',
  138: 'ADCBBDCA',
}

function buildTopicsAndTests() {
  const topics = []
  let testNo = 1

  for (let i = 0; i < TOC_SECTIONS.length - 1; i += 1) {
    const section = TOC_SECTIONS[i]
    const nextStart = TOC_SECTIONS[i + 1].start
    const pageSpan = nextStart - section.start
    const testCount = Math.floor(pageSpan / 2)

    const tests = []
    let cursor = section.start
    for (let t = 0; t < testCount; t += 1) {
      const pageStart = cursor
      const pageEnd = cursor + 1
      const answers = ANSWER_KEYS[testNo]
      if (!answers) {
        throw new Error(`Missing answer key for Test ${testNo}`)
      }
      tests.push({
        testNo,
        name: `Test ${testNo}`,
        pageStart,
        pageEnd,
        answers: answers.split(''),
      })
      testNo += 1
      cursor += 2
    }

    topics.push({ subtopicName: section.name, unite: section.unite, tests })
  }

  return { topics, lastTestNo: testNo - 1 }
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
    return { id: existing.recordset[0].id, isNew: false }
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
  return result.recordset[0].id
}

async function insertAnswerKey(pool, testId, answers) {
  if (!answers.length) return
  const values = []
  const request = pool.request().input('testId', sql.UniqueIdentifier, testId)
  answers.forEach((label, idx) => {
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

  const { topics, lastTestNo } = buildTopicsAndTests()
  if (lastTestNo !== 138) {
    throw new Error(`Expected 138 tests total, computed ${lastTestNo}`)
  }

  const pool = await sql.connect(connectionString)

  try {
    const publisherId = await getPublisherId(pool)
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

    // Group sub-topics by their ünite, and create one ResourceBookTopics row per ünite
    // (same hierarchy convention as the Fen Bilimleri book: ünite = İçerik, sub-topic = test's topic_name).
    const uniteTopicIds = {}
    for (const uniteNo of Object.keys(UNITE_NAMES)) {
      uniteTopicIds[uniteNo] = await insertTopic(pool, resourceBookId, UNITE_NAMES[uniteNo])
    }

    let totalTests = 0
    let totalAnswers = 0

    for (const topic of topics) {
      const uniteTopicId = uniteTopicIds[topic.unite]
      for (const test of topic.tests) {
        const testId = await insertTest(pool, uniteTopicId, topic.subtopicName, test)
        await insertAnswerKey(pool, testId, test.answers)
        totalTests += 1
        totalAnswers += test.answers.length
      }
      console.log(`Sub-topic "${topic.subtopicName}" (Ünite ${topic.unite}): ${topic.tests.length} test(s)`)
    }

    console.log(
      `Done. Üniteler: ${Object.keys(UNITE_NAMES).length}, Sub-topics: ${topics.length}, Tests: ${totalTests}, Answer key rows: ${totalAnswers}`,
    )
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
