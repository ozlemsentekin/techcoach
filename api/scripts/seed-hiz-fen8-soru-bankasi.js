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
const BOOK_NAME = '8. Sınıf Fen Bilimleri Soru Bankası'
const BOOK_PAGE_COUNT = 281

// Derived from the table of contents (İçindekiler): each named section spans from its
// own start page up to (but not including) the next section's start page. "Değerlendirme
// Testi" appears multiple times (once per ünite / twice in ünite 4) so those are
// disambiguated with a ünite prefix.
const TOC_SECTIONS = [
  { name: 'Mevsimlerin Oluşumu', start: 8 },
  { name: 'İklim ve Hava Hareketleri', start: 16 },
  { name: '1. Ünite Değerlendirme Testi', start: 22 },
  { name: 'DNA ve Genetik Kod', start: 35 },
  { name: 'Kalıtım', start: 43 },
  { name: 'Mutasyon, Modifikasyon ve Adaptasyon', start: 51 },
  { name: 'Biyoteknoloji', start: 57 },
  { name: '2. Ünite Değerlendirme Testi', start: 59 },
  { name: 'Katı Basıncı', start: 76 },
  { name: 'Sıvı Basıncı', start: 80 },
  { name: 'Gaz Basıncı', start: 84 },
  { name: '3. Ünite Değerlendirme Testi', start: 86 },
  { name: 'Periyodik Sistem', start: 101 },
  { name: 'Fiziksel ve Kimyasal Değişimler', start: 107 },
  { name: 'Kimyasal Tepkimeler', start: 109 },
  { name: 'Asitler ve Bazlar', start: 111 },
  { name: '4. Ünite Değerlendirme Testi (1)', start: 117 },
  { name: 'Isı ve Sıcaklık', start: 135 },
  { name: 'Sıcaklık Değişimi', start: 139 },
  { name: 'Hâl Değişimi', start: 141 },
  { name: 'Hâl Değişim Isıları', start: 143 },
  { name: 'Hâl Değişim Grafikleri', start: 145 },
  { name: '4. Ünite Değerlendirme Testi (2)', start: 147 },
  { name: 'Kimya Endüstrisi', start: 165 },
  { name: 'Sabit Makara', start: 170 },
  { name: 'Hareketli Makara', start: 172 },
  { name: 'Palanga', start: 174 },
  { name: 'Kaldıraç', start: 176 },
  { name: 'Eğik Düzlem', start: 182 },
  { name: 'Çıkrık', start: 186 },
  { name: 'Dişli Çark ve Kasnak', start: 188 },
  { name: 'Vida', start: 192 },
  { name: '5. Ünite Değerlendirme Testi', start: 194 },
  { name: 'Besin Zinciri ve Enerji Akışı', start: 213 },
  { name: 'Fotosentez', start: 217 },
  { name: 'Solunum', start: 219 },
  { name: 'Fotosentez - Solunum', start: 221 },
  { name: 'Madde Döngüleri ve Çevre Sorunları', start: 223 },
  { name: 'Sürdürülebilir Kalkınma', start: 227 },
  { name: '6. Ünite Değerlendirme Testi', start: 231 },
  { name: 'Elektrik Yükleri ve Elektriklenme', start: 252 },
  { name: 'Elektrik Yüklü Cisimler', start: 256 },
  { name: 'Elektrik Enerjisinin Dönüşümü', start: 258 },
  { name: '7. Ünite Değerlendirme Testi', start: 262 },
  // sentinel marking the end of content (Yanıt Anahtarı starts at 277)
  { name: '__END__', start: 277 },
]

// Answer key transcribed from the book's Yanıt Anahtarı pages (277-280), Test 1 - Test 131.
const ANSWER_KEYS = {
  1: 'ABCBBBCCCDA', 2: 'ABDBBACD', 3: 'CCADACA', 4: 'CBCBC',
  5: 'DADBCDADCAA', 6: 'CADADCA', 7: 'BDCDBC', 8: 'BCABC',
  9: 'BCCAA', 10: 'BABCD', 11: 'CBDBABD', 12: 'ADAB',
  13: 'CDCC', 14: 'CACBABADDA', 15: 'DCDBBACDA', 16: 'DBDDBBACAC',
  17: 'ACCBDC', 18: 'AADBBDDBDDCB', 19: 'CBADCCDBBCCD', 20: 'CCDACDBADAB',
  21: 'BBBCC', 22: 'CBBACDCDDABA', 23: 'DBAACBDDCCC', 24: 'DABDCDB',
  25: 'ADADCBBBC', 26: 'DABDAD', 27: 'CCDCD', 28: 'ACDC',
  29: 'BDB', 30: 'CCCDBDBD', 31: 'DACCD', 32: 'DADBCA',
  33: 'CADB', 34: 'CDABCBDACAD', 35: 'CCDADCBABC', 36: 'BCBADCCCA',
  37: 'BCBACBCB', 38: 'ADBAAABD', 39: 'ABDAC', 40: 'CBAABA',
  41: 'CDACBDB', 42: 'CABCBB', 43: 'CDAACB', 44: 'DBCAC',
  45: 'CBADA', 46: 'DAABCACCAAC', 47: 'CDADCCBDDDB', 48: 'DCCBDABC',
  49: 'ADBACDCDCBBC', 50: 'BDDBADDCBD', 51: 'ACACADCBCDBC', 52: 'CAACDCBDC',
  53: 'ACDBDCDAD', 54: 'AACAC', 55: 'DCAAB', 56: 'CCCCB',
  57: 'AABBBBD', 58: 'CCBDDAA', 59: 'DDDCBDC', 60: 'CBCBC',
  61: 'BDBDCD', 62: 'DDDD', 63: 'CDCADBBBABB', 64: 'CDADADBABCC',
  65: 'CDAACAAD', 66: 'CDBBADBACBCA', 67: 'ACCCCBCAADDDB', 68: 'BBBCDAB',
  69: 'DADBACDA', 70: 'CABBDDCB', 71: 'BDBBDBAB', 72: 'CBBCCCC',
  73: 'DBCCBCDCA', 74: 'CCAACCCB', 75: 'ADBADA', 76: 'BDBACCC',
  77: 'ADCD', 78: 'BBADDCACACA', 79: 'DDCADDBABDCD', 80: 'ADDABBCCC',
  81: 'CBCCCCDCCA', 82: 'DDBCDDCD', 83: 'CCABDCCAD', 84: 'BBDABCBD',
  85: 'CADDCADBA', 86: 'DBBBCCDCD', 87: 'BADACBAD', 88: 'DDAADBAC',
  89: 'ACDBBDCB', 90: 'CCABDABCD', 91: 'CAAABBAABBC', 92: 'CDCDABC',
  93: 'ABACCBD', 94: 'BAAACDB', 95: 'BBCADC', 96: 'ACBBBCB',
  97: 'BCBBC', 98: 'CBCCCC', 99: 'ADCCDB', 100: 'CBCCA',
  101: 'CABCCDBCDA', 102: 'CCABDCDADB', 103: 'DADBCBCBAC', 104: 'CDACBCBCA',
  105: 'ABDBCCBADD', 106: 'DACBCDCBDD', 107: 'CDCDDDBAA', 108: 'BDDCADBDBBCA',
  109: 'DAABBCAAD', 110: 'DDCDBAD', 111: 'CBCDDC', 112: 'CDBAACD',
  113: 'CBACDDC', 114: 'ACADCBD', 115: 'DCCACCA', 116: 'ACDCBAA',
  117: 'CDADCAD', 118: 'BABBDD', 119: 'ABCCB', 120: 'CBCBDDCBDD',
  121: 'DBCBCADCADC', 122: 'BBCBDDBABB', 123: 'DBDDBCBBC', 124: 'ACACCBDADD',
  125: 'BCBDADB', 126: 'BDACCCACB', 127: 'CAABB', 128: 'BDCCA',
  129: 'ABBCD', 130: 'BBAABCB', 131: 'AAABCD',
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

    topics.push({ name: section.name, tests })
  }

  return { topics, lastTestNo: testNo - 1 }
}

async function getOrCreatePublisher(pool) {
  const existing = await pool
    .request()
    .input('name', sql.NVarChar(150), PUBLISHER_NAME)
    .query('SELECT id FROM dbo.Publishers WHERE name = @name;')

  if (existing.recordset.length) {
    return existing.recordset[0].id
  }

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

  if (!result.recordset.length) {
    throw new Error(`Subject not found: ${SUBJECT_NAME}`)
  }

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
  if (!connectionString) {
    throw new Error('SQL_CONNECTION_STRING is missing.')
  }

  const { topics, lastTestNo } = buildTopicsAndTests()
  if (lastTestNo !== 131) {
    throw new Error(`Expected 131 tests total, computed ${lastTestNo}`)
  }

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
    let totalAnswers = 0

    for (const topic of topics) {
      const topicId = await insertTopic(pool, resourceBookId, topic.name)
      for (const test of topic.tests) {
        const testId = await insertTest(pool, topicId, topic.name, test)
        await insertAnswerKey(pool, testId, test.answers)
        totalTests += 1
        totalAnswers += test.answers.length
      }
      console.log(`Topic "${topic.name}": ${topic.tests.length} test(s)`)
    }

    console.log(`Done. Topics: ${topics.length}, Tests: ${totalTests}, Answer key rows: ${totalAnswers}`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
