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
const BOOK_NAME = '8. Sınıf Matematik Güçlendiren Soru Bankası'
const BOOK_PAGE_COUNT = 320 // approximate: content ends ~315 (Cevap Anahtarı start) + a few answer-key pages

// Pages per test are approximated from question count (≈4 questions/page, per the book owner's
// own rule of thumb), starting from each ünite's confirmed İçindekiler page and walking forward
// through that ünite's named sub-topics as page anchors. Some sub-topic anchors were not legible
// in the İçindekiler photo and are linearly interpolated between the nearest confirmed anchors
// (marked "interpolated" below) — these are approximate, not exact.
const UNITELER = [
  {
    name: 'Çarpanlar ve Katlar',
    segments: [
      { name: 'Pozitif Tam Sayıların Çarpanları', start: 11 },
      { name: 'En Büyük Ortak Bölen (EBOB)', start: 17 },
      { name: 'En Küçük Ortak Kat (EKOK)', start: 21 },
      { name: 'Aralarında Asal Sayılar', start: 25 },
      { name: 'Çarpanlar ve Katlar', start: 29 },
    ],
    sentinel: 41,
    tests: [
      [12, 'DDCBAADCBCDC'],
      [12, 'DAADBCCABBDA'],
      [6, 'ABDBCC'],
      [12, 'DBADBBAACADA'],
      [6, 'ABCDCC'],
      [12, 'DACBBDAABCDC'],
      [6, 'DDCABB'],
      [12, 'DCACBABCBABD'],
      [6, 'DBABCD'],
      [8, 'ADCCDCCB'],
      [8, 'CACDCDBA'],
      [8, 'ABDCBDBC'],
    ],
  },
  {
    name: 'Üslü İfadeler',
    segments: [
      { name: 'Tam Sayıların Tam Sayı Kuvvetleri', start: 41 },
      { name: 'Üslü İfadelerde Çarpma İşlemi', start: 45 },
      { name: 'Üslü İfadelerde Bölme İşlemi', start: 47 },
      { name: 'Ondalık Gösterimleri Çözümleme', start: 53 },
      { name: "10'un Tam Sayı Kuvvetleri", start: 57 },
      { name: 'Bilimsel Gösterim', start: 59 },
      { name: 'Üslü İfadeler', start: 63 },
    ],
    sentinel: 77,
    tests: [
      [12, 'DDDCBDAAADAC'],
      [6, 'CBCCDB'],
      [12, 'CCADBABAACCB'],
      [11, 'ADCACCADDAD'],
      [12, 'CAADCABCCADD'],
      [6, 'DDABAB'],
      [12, 'CBBCADABBCDC'],
      [5, 'BCBAD'],
      [13, 'BBAADDCCDAADD'],
      [12, 'CDDBBACABBAC'],
      [6, 'DABBAA'],
      [8, 'CBCCABCA'],
      [8, 'ADBCBABC'],
      [7, 'BCBBABC'],
    ],
  },
  {
    name: 'Kareköklü İfadeler',
    segments: [
      { name: 'Tamkare Doğal Sayılar', start: 77 },
      { name: 'Tamkare Olmayan Doğal Sayıların Karekök Değerlerinin Aralıkları', start: 81 },
      { name: 'Tamkare Olmayan Kareköklü İfadelerin Farklı Biçimlerde Gösterimi', start: 83 },
      { name: 'Kareköklü İfadelerle Çarpma İşlemi', start: 87 },
      { name: 'Kareköklü İfadelerle Bölme İşlemi', start: 91 },
      { name: 'Kareköklü İfadelerle Toplama ve Çıkarma İşlemi', start: 95 },
      { name: 'Ondalık Gösterimlerin Karekökü', start: 99 },
      { name: 'Gerçek Sayılar', start: 101 },
      { name: 'Kareköklü İfadeler', start: 105 },
    ],
    sentinel: 117,
    tests: [
      [12, 'BADABCCACCDC'],
      [5, 'BCCDC'],
      [12, 'ACBCDCBABBAB'],
      [13, 'AADDACCADABBD'],
      [6, 'CACDCC'],
      [12, 'BCDCCDBDBCDC'],
      [6, 'ABDBDA'],
      [12, 'CBBABADCACBA'],
      [6, 'BABACB'],
      [12, 'CACCBABCCCDC'],
      [6, 'DCCDAC'],
      [14, 'CBAACDABCCADDB'],
      [14, 'CDCABBCACCDCDB'],
      [4, 'DAAC'],
      [8, 'ABBBDDCA'],
      [7, 'CABBADB'],
      [8, 'BCABDACB'],
    ],
  },
  {
    name: 'Veri Analizi',
    segments: [
      { name: 'Grafik Yorumlama', start: 117 },
      { name: 'Grafikler Arası Dönüşümler', start: 121 },
      { name: 'Veri Analizi', start: 125 },
    ],
    sentinel: 139,
    tests: [
      [10, 'BDDCDACBAD'],
      [5, 'DBCDB'],
      [6, 'ABCBBC'],
      [2, 'AD'],
      [6, 'ACDCDA'],
      [6, 'DBADCA'],
      [6, 'DADDCB'],
    ],
  },
  {
    name: 'Basit Olayların Olma Olasılığı',
    segments: [
      { name: 'Olasılık Kavramları', start: 139 },
      { name: 'Olasılık Değeri', start: 143 },
      { name: 'Olasılık Hesabı', start: 145 },
      { name: 'Basit Olayların Olma Olasılığı', start: 149 },
    ],
    sentinel: 157,
    tests: [
      [10, 'DADCCDBDDB'],
      [5, 'CBBBA'],
      [12, 'DCACABBCDDDD'],
      [12, 'CBABCACDABCD'],
      [6, 'CCCAAB'],
      [8, 'ADABACAB'],
      [8, 'DABCCDBC'],
    ],
  },
  {
    name: 'Cebirsel İfadeler ve Özdeşlikler',
    segments: [
      { name: 'Cebirsel İfadeler ve Özdeşlikler (Giriş)', start: 157 },
      { name: 'Basit Cebirsel İfadeler ve Cebirsel İfadelerle Çarpma İşlemi', start: 161 },
      { name: 'Özdeşlikler', start: 163 },
      { name: 'Cebirsel İfadeleri Çarpanlara Ayırma', start: 169 },
      { name: 'Cebirsel İfadeler ve Özdeşlikler', start: 183 },
    ],
    sentinel: 187,
    tests: [
      [12, 'BCACDBBDBDAD'],
      [5, 'DBBCA'],
      [12, 'CAABACBCDCCC'],
      [13, 'ABDDABAADBCDD'],
      [10, 'CDDCCBBDDA'],
      [6, 'DAADDB'],
      [8, 'ACAADADC'],
      [6, 'BADBDC'],
      [8, 'BBDBDCDB'],
    ],
  },
  {
    name: 'Doğrusal Denklemler',
    segments: [
      { name: 'Doğrusal Denklemler (Giriş)', start: 187 },
      { name: 'Birinci Dereceden Bir Bilinmeyenli Denklemler', start: 191 },
      { name: 'Koordinat Sistemi', start: 197 },
      { name: 'Doğrusal Denklemlerin Grafiği', start: 201 },
      { name: 'Doğrusal İlişki', start: 207 },
      { name: 'Doğrusal Eğim', start: 211 }, // interpolated
      { name: 'Doğrusal Denklemler', start: 217 }, // interpolated
    ],
    sentinel: 221,
    tests: [
      [12, 'DACADACDDACC'],
      [6, 'BBAAAC'],
      [13, 'CADBAACABCDAD'],
      [5, 'DDCCB'],
      [12, 'CBDBDDCABCCA'],
      [12, 'DDCADABCADAB'],
      [5, 'BDCBB'],
      [9, 'CADBCAABA'],
      [6, 'DCBCCA'],
      [9, 'CCCBBDCBD'],
      [9, 'BCCDABABD'],
      [5, 'ADBBC'],
      [8, 'AABCCDDB'],
      [8, 'CBBDCCBC'],
      [12, 'CDACCABABADB'],
    ],
  },
  {
    name: 'Eşitsizlikler',
    segments: [
      { name: 'Eşitsizlikler (Giriş)', start: 221 },
      { name: 'Eşitsizlik Yazma ve Sayı Doğrusunda Gösterme', start: 225 },
      { name: 'Eşitsizlik Çözme', start: 229 },
      { name: 'Eşitsizlikler', start: 231 }, // interpolated
    ],
    sentinel: 235,
    tests: [
      [11, 'CCBADDCCDCD'],
      [6, 'CDCACD'],
      [12, 'CADBBCDDDCAB'],
      [5, 'AAACD'],
      [9, 'CBCCCACBB'],
    ],
  },
  {
    name: 'Üçgenler',
    segments: [
      { name: 'Üçgenler (Giriş)', start: 235 },
      { name: 'Üçgenin Yardımcı Elemanları', start: 237 },
      { name: 'Üçgenin Kenar Bağıntıları', start: 239 },
      { name: 'Üçgenin Yardımcı Elemanları ve Kenar Bağıntıları', start: 241 },
      { name: 'Üçgenlerde Açı Kenar Bağıntıları', start: 243 },
      { name: 'Üçgen Çizimi', start: 245 },
      { name: 'Üçgenlerde Açı Kenar Bağıntıları ve Üçgen Çizimi', start: 247 },
      { name: 'Dik Üçgen ve Pisagor Bağıntısı', start: 253 },
      { name: 'Üçgenler', start: 259 }, // interpolated
    ],
    sentinel: 263,
    tests: [
      [11, 'BCDCDDDABBB'],
      [11, 'BBCADDDABBB'],
      [4, 'CBCA'],
      [10, 'CACCDACDBB'],
      [11, 'CBDCACCBBCD'],
      [4, 'AAAC'],
      [11, 'ABDBDCDDCCC'],
      [11, 'BADABBCACCB'],
      [4, 'BCBA'],
      [8, 'BBCCCCCA'],
      [12, 'DADDCAABBADB'],
    ],
  },
  {
    name: 'Eşlik ve Benzerlik',
    segments: [
      { name: 'Eşlik ve Benzerlik (Giriş)', start: 263 },
      { name: 'Eşlik ve Benzerlik Kavramı', start: 267 },
      { name: 'Eşlik ve Benzerlik Oranı', start: 271 },
      { name: 'Eşlik ve Benzerlik', start: 274 }, // interpolated
    ],
    sentinel: 277,
    tests: [
      [11, 'DCBCBCBDDAC'],
      [4, 'DBDB'],
      [10, 'CBDACCBDBC'],
      [5, 'ACADB'],
      [7, 'BBDCBDD'],
    ],
  },
  {
    name: 'Dönüşüm Geometrisi',
    segments: [
      { name: 'Dönüşüm Geometrisi (Giriş)', start: 277 },
      { name: 'Öteleme', start: 281 },
      { name: 'Yansıma', start: 287 },
      { name: 'Dönüşüm Geometrisi', start: 289 }, // interpolated
    ],
    sentinel: 291,
    tests: [
      [9, 'ADAABBABB'],
      [3, 'DCD'],
      [8, 'ABDCDBAD'],
      [9, 'ABDCDCAAC'],
      [4, 'ABDB'],
      [8, 'CCCBAACB'],
    ],
  },
  {
    name: 'Geometrik Cisimler',
    segments: [
      { name: 'Geometrik Cisimler (Giriş)', start: 291 },
      { name: 'Dik Prizmalar', start: 295 },
      { name: 'Dik Dairesel Silindir ve Alanı', start: 299 },
      { name: 'Dik Dairesel Silindirin Hacmi', start: 305 },
      { name: 'Dik Piramit', start: 307 },
      { name: 'Dik Koni', start: 311 },
      { name: 'Geometrik Cisimler', start: 313 }, // interpolated
    ],
    sentinel: 315,
    tests: [
      [9, 'DDCBCCBBD'],
      [4, 'CAAB'],
      [9, 'DABBBCCAC'],
      [9, 'CBCDBCABC'],
      [10, 'DBAAACBACD'],
      [9, 'CDBCBBDCB'],
      [4, 'BBCD'],
      [8, 'DCCDBDCA'],
      [8, 'DACDCDAD'],
      [4, 'BCDC'],
      [8, 'BCBCCCDD'],
    ],
  },
]

function buildTests(unite) {
  const segments = [...unite.segments, { name: '__SENTINEL__', start: unite.sentinel }]
  let cursor = segments[0].start
  const built = []

  unite.tests.forEach(([count, answers], idx) => {
    if (answers.length !== count) {
      throw new Error(`${unite.name} Test ${idx + 1}: expected ${count} answers, got ${answers.length}`)
    }

    let topicName = segments[0].name
    for (const seg of segments) {
      if (seg.start <= cursor) topicName = seg.name === '__SENTINEL__' ? topicName : seg.name
    }

    const pages = Math.max(1, Math.ceil(count / 4))
    const pageStart = cursor
    const pageEnd = cursor + pages - 1

    built.push({
      testNo: idx + 1,
      topicName,
      pageStart,
      pageEnd,
      answers: answers.split(''),
    })

    cursor = pageEnd + 1
  })

  return built
}

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

    for (const unite of UNITELER) {
      const tests = buildTests(unite)
      const topicId = await insertTopic(pool, resourceBookId, unite.name)

      for (const test of tests) {
        const testId = await insertTest(
          pool,
          topicId,
          test.topicName,
          `Test ${test.testNo}`,
          test.pageStart,
          test.pageEnd,
          test.answers.length,
        )
        await insertAnswerKey(pool, testId, test.answers)
        totalTests += 1
        totalAnswers += test.answers.length
      }

      console.log(`İçerik "${unite.name}": ${tests.length} test`)
    }

    console.log(`\nDone. İçerik: ${UNITELER.length}, Test: ${totalTests}, Cevap anahtarı satırı: ${totalAnswers}`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
