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

const PUBLISHER_NAME = 'Fenomen Yayınları'
const BOOK_NAME = '%100 Başarı İçin Matematik Soru Bankası'

const UNITE1 = '1. Ünite - Çarpanlar, Katlar ve Üslü İfadeler'
const UNITE2 = '2. Ünite - Kareköklü İfadeler ve Veri Analizi'
const UNITE3 = '3. Ünite - Olasılık, Cebirsel İfadeler ve Özdeşlikler'
const UNITE4 = '4. Ünite - Doğrusal Denklemler ve Eşitsizlikler'
const UNITE5 = '5. Ünite - Üçgenler, Eşlik ve Benzerlik'

// Each entry: [topic, testName, testTopicName, expectedCount, answers]
// Transcribed from the book's own answer-key summary tables, matched to existing DB rows by
// (topic, test name, test topic label); expectedCount is cross-checked against the DB's stored
// question_count before inserting, so any transcription/matching mistake fails loudly instead of
// silently writing wrong answers.
const ENTRIES = [
  // Ünite 1 — Çarpanlar ve Katlar
  [UNITE1, 'Test 1', 'Çarpanlar ve Katlar', 13, 'DBDCACBBCDDCA'],
  [UNITE1, 'Test 2', 'Çarpanlar ve Katlar', 12, 'CAADDCBCDBCA'],
  [UNITE1, 'Test 3', 'Çarpanlar ve Katlar', 8, 'CBABBCDA'],
  [UNITE1, 'Test 4', 'Çarpanlar ve Katlar', 9, 'DACCCBDCC'],
  [UNITE1, 'Test 5', 'En Büyük Ortak Bölen', 12, 'BDADCBDCDABB'],
  [UNITE1, 'Test 6', 'EBOB Problemleri', 12, 'ACBDCACCBBAC'],
  [UNITE1, 'Test 7', 'En Küçük Ortak Kat (EKOK)', 12, 'CBCCBBBBCBAB'],
  [UNITE1, 'Test 8', 'EKOK Problemleri', 12, 'CBCACAABCCBB'],
  [UNITE1, 'Test 9', 'EBOB ve EKOK', 32, null], // already answered
  [UNITE1, 'Test 10', 'EBOB ve EKOK', 8, null], // already answered
  [UNITE1, 'Test 11', 'Aralarında Asal Sayılar', 12, 'CBDCBCCDDDCD'],
  [UNITE1, 'Test 12', 'Aralarında Asal Sayılar', 12, 'CBDCCCDCBADC'],
  [UNITE1, 'Test 13', 'Aralarında Asal Sayılar', 16, 'CBCBDCDACDBADBDB'],
  [UNITE1, 'Test 14', 'Aralarında Asal Sayılar', 4, 'CCBA'],

  // Ünite 1 — Üslü İfadeler
  [UNITE1, 'Test 1', 'Tam Sayıların Tam Sayı Kuvvetleri', 14, 'DAADABBCADCADB'],
  [UNITE1, 'Test 2', 'Tam Sayıların Tam Sayı Kuvvetleri', 13, 'ADADBBDBCCCAC'],
  [UNITE1, 'Test 3', 'Tam Sayıların Tam Sayı Kuvvetleri', 16, 'CBCACABCBDACADAC'],
  [UNITE1, 'Test 4', 'Tam Sayıların Tam Sayı Kuvvetleri', 4, 'DACB'],
  [UNITE1, 'Test 5', 'Üslü İfadelerde Çarpma İşlemi', 13, 'CBCCBCBCACCBD'],
  [UNITE1, 'Test 6', 'Üslü İfadelerde Bölme İşlemi', 14, 'CCABCCCAABCDAD'],
  [UNITE1, 'Test 7', 'Üslü İfadelerde Çarpma ve Bölme İşlemi', 12, 'DADBDACBBBCA'],
  [UNITE1, 'Test 8', 'Üslü İfadelerde Çarpma ve Bölme İşlemi', 32, 'CACDCACBACDAACDACDBCBCADCCACDCBD'],
  [UNITE1, 'Test 9', 'Üslü İfadelerde Çarpma ve Bölme İşlemi', 8, 'CCDDCCDC'],
  [UNITE1, 'Test 10', "Ondalık Gösterimleri 10 un Tam Sayı Kuvvetlerini Kullanarak Çözümleme", 12, 'CDBBCBBDCBCB'],
  [UNITE1, 'Test 11', "Ondalık Gösterimleri 10 un Tam Sayı Kuvvetlerini Kullanarak Çözümleme", 8, 'CCBDBCBD'],
  [UNITE1, 'Test 12', "Ondalık Gösterimleri 10 un Tam Sayı Kuvvetlerini Kullanarak Çözümleme", 4, 'BDCC'],
  [UNITE1, 'Test 13', 'Çok Küçük ve Çok Büyük Sayıların Bilimsel Gösterimi', 12, 'BBDCDACCCDBB'],
  [UNITE1, 'Test 14', 'Çok Küçük ve Çok Büyük Sayıların Bilimsel Gösterimi', 12, 'CBDDDBABCCCB'],
  [UNITE1, 'Test 15', 'Çok Küçük ve Çok Büyük Sayıların Bilimsel Gösterimi', 16, 'DCADDCCBAADDDBDC'],
  [UNITE1, 'Test 16', 'Çok Küçük ve Çok Büyük Sayıların Bilimsel Gösterimi', 4, 'CACA'],

  // Ünite 2 — Kareköklü İfadeler
  [UNITE2, 'Test 1', 'Tamkare Doğal Sayılar', 11, 'DBCCDACCDDB'],
  [UNITE2, 'Test 2', 'Tamkare Pozitif Tam Sayıların Karekökü', 11, 'DBCDCBCBDDA'],
  [UNITE2, 'Test 3', 'Tamkare Pozitif Tam Sayıların Karekökü', 8, 'CACBBCDB'],
  [UNITE2, 'Test 4', 'Tamkare Doğal Sayılar ve Tamkare Pozitif Tam Sayıların Karekökü', 4, 'BDCB'],
  [UNITE2, 'Test 5', 'Tamkare Olmayan Pozitif Tam Sayıların Karekökü', 12, 'DCBCDABCCBCC'],
  [UNITE2, 'Test 6', 'Kareköklü İfadelerin Farklı Gösterimi', 11, 'CBCDBACBCBC'],
  [UNITE2, 'Test 7', 'Tamsayı Olmayan Pozitif Tam Sayıların Karekökü ve Kareköklü İfadelerin Farklı Gösterimi', 16, 'BDCACADDBCBDCDBC'],
  [UNITE2, 'Test 8', 'Tamsayı Olmayan Pozitif Tam Sayıların Karekökü ve Kareköklü İfadelerin Farklı Gösterimi', 8, 'CDDBDABD'],
  [UNITE2, 'Test 9', 'Kareköklü İfadelerle Çarpma ve Bölme İşlemleri', 12, 'BCCACCBBACAD'],
  [UNITE2, 'Test 10', 'Kareköklü İfadelerle Çarpma ve Bölme İşlemleri', 12, 'BBACDBBCDDBB'],
  [UNITE2, 'Test 11', 'Kareköklü İfadelerle Çarpma ve Bölme İşlemleri', 16, 'CCABDCBCCBDBCDBC'],
  [UNITE2, 'Test 12', 'Kareköklü İfadelerle Çarpma ve Bölme İşlemleri', 4, 'DBDC'],
  [UNITE2, 'Test 13', 'Kareköklü İfadelerle Toplama ve Çıkarma İşlemleri', 12, 'BDCCBDBCDBCD'],
  [UNITE2, 'Test 14', 'Kareköklü İfadelerle Toplama ve Çıkarma İşlemleri', 11, 'ACDDCDDCCDC'],
  [UNITE2, 'Test 15', 'Kareköklü İfadelerle Toplama ve Çıkarma İşlemleri', 16, 'CDBDDCBDBCBDBACC'],
  [UNITE2, 'Test 16', 'Kareköklü İfadelerle Toplama ve Çıkarma İşlemleri', 8, 'BBCBDBCC'],
  [UNITE2, 'Test 17', 'Ondalık Gösterimlerin Karekökleri', 12, 'CDCABCBDBCCC'],
  [UNITE2, 'Test 18', 'Gerçek Sayılar', 12, 'CDBDCBBBCCBC'],
  [UNITE2, 'Test 19', 'Ondalık Gösterimlerin Karekökleri ve Gerçek Sayılar', 16, 'CCDADBCBCDBCBBBC'],
  [UNITE2, 'Test 20', 'Ondalık Gösterimlerin Karekökleri ve Gerçek Sayılar', 4, 'BCDD'],

  // Ünite 2 — Veri Analizi
  [UNITE2, 'Test 1', 'Veri Analizi', 11, 'DCDBDDDCDBB'],
  [UNITE2, 'Test 2', 'Veri Analizi', 8, 'BDCACCBD'],
  [UNITE2, 'Test 3', 'Veri Analizi', 16, 'BBCDADCCDCCADACC'],
  [UNITE2, 'Test 4', 'Veri Analizi', 4, 'BACC'],

  // Ünite 3 — Olasılık
  [UNITE3, 'Test 1', 'Olasılık', 11, 'CBBBCDCDCBC'],
  [UNITE3, 'Test 2', 'Olasılık', 12, 'BBCDDABACBAB'],
  [UNITE3, 'Test 3', 'Olasılık', 24, 'CBDADCBCBDCCCDBDADCDDBDD'],
  [UNITE3, 'Test 4', 'Olasılık', 8, 'CDCADCAC'],

  // Ünite 3 — Cebirsel İfadeler ve Özdeşlikler
  [UNITE3, 'Test 1', 'Cebirsel İfadeler ve Özdeşlikler', 12, 'ADABBCBADCAC'],
  [UNITE3, 'Test 2', 'İki Terimin Toplamının ve Farkının Karesi (Tamkare Özdeşliği)', 15, 'CBDCDACDBABCDCB'],
  [UNITE3, 'Test 3', 'İki Kare Farkı Özdeşliği', 13, 'CBADBCDDADBBB'],
  [UNITE3, 'Test 4', 'Cebirsel İfadeleri Çarpanlarına Ayırma', 13, 'CDBCADCCADACB'],
  [UNITE3, 'Test 5', 'Cebirsel İfadeler ve Özdeşlikler', 24, 'BCBADCCAABDCCADDABCADCAC'],
  [UNITE3, 'Test 6', 'Cebirsel İfadeler ve Özdeşlikler', 8, 'CBCBDAAB'],

  // Ünite 4 — Bir Bilinmeyenli Denklemler
  [UNITE4, 'Test 1', 'Bir Bilinmeyenli Denklemler', 12, 'CBBADACADDCD'],
  [UNITE4, 'Test 2', 'Bir Bilinmeyenli Denklemler', 12, 'DBCCBCAAADBC'],
  [UNITE4, 'Test 3', 'Bir Bilinmeyenli Denklemler', 12, 'ABCCBDCBCBAD'],
  [UNITE4, 'Test 4', 'Bir Bilinmeyenli Denklemler', 24, 'CCCCBACABDADCDCAACDBDBCC'],
  [UNITE4, 'Test 5', 'Bir Bilinmeyenli Denklemler', 8, 'CBBCABBA'],

  // Ünite 4 — Koordinat Sistemi ve Doğrusal İlişki
  [UNITE4, 'Test 1', 'Koordinat Sistemi', 12, 'DACDCAABBCAC'],
  [UNITE4, 'Test 2', 'Koordinat Sistemi', 12, 'DABCDCCCCADC'],
  [UNITE4, 'Test 3', 'Doğrusal Denklemlerin Grafiği', 12, 'DCBBACCBDCAA'],
  [UNITE4, 'Test 4', 'Doğrusal Denklemlerin Grafiği', 13, 'CACBDACDBADCA'],
  [UNITE4, 'Test 5', 'Doğrusal İlişki', 12, 'DAACBDCDADCB'],
  [UNITE4, 'Test 6', 'Doğrusal İlişki ve Grafiği', 12, 'DCCBCCBABCCD'],
  [UNITE4, 'Test 7', 'Doğrusal İlişki ve Grafiği', 16, 'CCBADBCDCBCCCDAA'],
  [UNITE4, 'Test 8', 'Doğrusal Denklemler ve Grafikleri', 8, 'DCBCCBCC'],

  // Ünite 4 — Eğim
  [UNITE4, 'Test 1', 'Doğrunun Eğimi', 11, 'BCBDADCCADD'],
  [UNITE4, 'Test 2', 'Doğrunun Eğimi', 9, 'ACDACBACD'],
  [UNITE4, 'Test 3', 'Doğrunun Eğimi', 13, 'CDCBCCACBBCDA'],
  [UNITE4, 'Test 4', 'Doğrunun Eğimi', 16, 'CBBCCACBCDCAABBC'],
  [UNITE4, 'Test 5', 'Doğrunun Eğimi', 4, 'BCAB'],

  // Ünite 4 — Eşitsizlikler
  [UNITE4, 'Test 1', 'Eşitsizlikler', 12, 'CDBCBCBDCDCD'],
  [UNITE4, 'Test 2', 'Eşitsizlikler', 12, 'ACBCCBCCADDD'],
  [UNITE4, 'Test 3', 'Eşitsizlikler', 12, 'CDCCBCDCCDCB'],
  [UNITE4, 'Test 4', 'Eşitsizlikler', 16, 'CDBCCBDCCBBCDACB'],
  [UNITE4, 'Test 5', 'Eşitsizlikler', 8, 'BCDDCBBC'],

  // Ünite 5 — Açı Kenar Bağıntıları grubu
  [UNITE5, 'Test 1', 'Üçgende Yardımcı Elemanlar', 12, 'BAADABCDBCCC'],
  [UNITE5, 'Test 2', 'Üçgende Yardımcı Elemanlar', 12, 'CDBADCBDBCCD'],
  [UNITE5, 'Test 3', 'Üçgende Yardımcı Elemanlar', 8, 'BCADBBDA'],
  [UNITE5, 'Test 4', 'Üçgende Yardımcı Elemanlar', 8, 'BBBCDBCC'],
  [UNITE5, 'Test 5', 'Üçgenlerde Kenar Bağıntıları', 12, 'CDDBABDBAAAB'],
  [UNITE5, 'Test 6', 'Açı Bağıntıları', 12, 'ABACBDCBBACB'],
  [UNITE5, 'Test 7', 'Üçgen Çizim Şartları', 12, 'DDCADCBDCBDB'],
  [UNITE5, 'Test 8', 'Açı Kenar Bağıntıları', 8, 'CBBABBCB'],
  [UNITE5, 'Test 9', 'Açı Kenar Bağıntıları', 8, 'CBDCADAC'],

  // Ünite 5 — Pisagor
  [UNITE5, 'Test 10', 'Pisagor Bağıntısı', 12, 'CDACDCBDDBDA'],
  [UNITE5, 'Test 11', 'Pisagor Bağıntısı', 12, 'DCBBCCCDACBD'],
  [UNITE5, 'Test 12', 'Pisagor Bağıntısı', 8, 'DBBDDADB'],
  [UNITE5, 'Test 13', 'Pisagor Bağıntısı', 8, 'ACBABCBC'],
]

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  for (const [topic, testName, testTopicName, count, answers] of ENTRIES) {
    if (answers !== null && answers.length !== count) {
      throw new Error(
        `Length mismatch: ${topic} / ${testName} / ${testTopicName} — expected ${count}, got ${answers.length}`,
      )
    }
  }

  const pool = await sql.connect(connectionString)

  try {
    const bookResult = await pool
      .request()
      .input('publisherName', sql.NVarChar(150), PUBLISHER_NAME)
      .input('bookName', sql.NVarChar(200), BOOK_NAME).query(`
        SELECT rb.id FROM dbo.ResourceBooks rb
        INNER JOIN dbo.Publishers p ON p.id = rb.publisher_id
        WHERE p.name = @publisherName AND rb.name = @bookName;
      `)
    if (!bookResult.recordset.length) throw new Error('ResourceBook not found')
    const resourceBookId = bookResult.recordset[0].id

    const rowsResult = await pool
      .request()
      .input('resourceBookId', sql.UniqueIdentifier, resourceBookId).query(`
        SELECT t.name AS topic_name, tt.id AS test_id, tt.name AS test_name, tt.topic_name AS test_topic_name,
          tt.question_count,
          (SELECT COUNT(*) FROM dbo.TestAnswerKeys ak WHERE ak.test_id = tt.id) AS answer_count
        FROM dbo.ResourceBookTopics t
        INNER JOIN dbo.ResourceBookTopicTests tt ON tt.topic_id = t.id
        WHERE t.resource_book_id = @resourceBookId;
      `)

    const byKey = new Map()
    for (const row of rowsResult.recordset) {
      const key = `${row.topic_name}||${row.test_name}||${row.test_topic_name}`
      byKey.set(key, row)
    }

    let inserted = 0
    let skippedAlready = 0
    let skippedNoAnswers = 0
    const notFound = []

    for (const [topic, testName, testTopicName, count, answers] of ENTRIES) {
      const key = `${topic}||${testName}||${testTopicName}`
      const row = byKey.get(key)

      if (!row) {
        notFound.push(key)
        continue
      }
      if (row.question_count !== count) {
        throw new Error(`Question count mismatch for ${key}: DB has ${row.question_count}, expected ${count}`)
      }
      if (answers === null) {
        skippedNoAnswers += 1
        continue
      }
      if (row.answer_count > 0) {
        console.log(`Skip (already has answer key): ${key}`)
        skippedAlready += 1
        continue
      }

      const letters = answers.split('')
      const request = pool.request().input('testId', sql.UniqueIdentifier, row.test_id)
      const values = []
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
      inserted += 1
      console.log(`Inserted: ${key} (${letters.length} answers)`)
    }

    console.log(`\nDone. Inserted: ${inserted}, already had answers: ${skippedAlready}, no image data (skipped by design): ${skippedNoAnswers}`)
    if (notFound.length) {
      console.log(`Not found in DB (skipped): ${notFound.length}`)
      notFound.forEach((k) => console.log(`  - ${k}`))
    }
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Fill failed')
  console.error(error)
  process.exit(1)
})
