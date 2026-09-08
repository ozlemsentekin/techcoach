const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const localSettingsPath = path.join(__dirname, '..', 'local.settings.json')
function loadLocalSettings() {
  if (!fs.existsSync(localSettingsPath)) return
  const parsed = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([key, value]) => {
    if (!process.env[key] && typeof value === 'string') process.env[key] = value
  })
}

// "Biltest Türkçe Soru Bankası 8. Sınıf" — FAZ 2: cevap anahtarı + question_count.
// seed-biltest-turkce8-soru-bankasi.js (FAZ 1) İçerik + test + sayfa yazmıştı; bu script
// kitabın "Yanıt Anahtarı" sayfalarından (s. 271-272, net/düz fotoğraflar, birden çok çekimle
// çapraz kontrol) her testin cevap dizisini ekler ve question_count / page_end / page_count'u
// soru sayısına göre (~4 soru/sayfa) günceller.
//
// İdempotent: her testin TestAnswerKeys satırları silinip yeniden yazılır.
const RESOURCE_BOOK_ID = '20F36DF8-25F8-4977-8724-A1A41D8AA8B0'

// no -> cevap dizisi (Yanıt Anahtarı sırası). question_count = dizinin uzunluğu.
const ANSWERS = {
  1: 'CDDABDCBA',
  2: 'ABCADDBC',
  3: 'BAADBCBDC',
  4: 'CBDCBACABD',
  5: 'DADDBCBABACBACDCCB',
  6: 'ACDBCABDCBADDBC',
  7: 'BACCDBDCCBDABAD',
  8: 'ADBDADBCCDABCB',
  9: 'CCCAACDBACADDB',
  10: 'BCDBACACBDABACA',
  11: 'BCDABCCDBADCBABA',
  12: 'CBDBCABDCA',
  13: 'CDACBDCAB',
  14: 'AABCDBBADCDCA',
  15: 'BACADADC',
  16: 'CBADABDCB',
  17: 'ADBCDDBCA',
  18: 'CDCBBDA',
  19: 'BCADCBADBACD',
  20: 'BCDBACCBADCABCBCAD',
  21: 'AABCCDBDBACCDD',
  22: 'BACBDDCADCCBDABABAD',
  23: 'BACABCAACBDDCCB',
  24: 'BCABDCADDABCBAADC',
  25: 'BDCDACABBC',
  26: 'CADBBCDABDAB',
  27: 'DCBCBADDBBCDCAA',
  28: 'CBBADCABC',
  29: 'BABCADCDC',
  30: 'DBCBACBD',
  31: 'DBACADCAB',
  32: 'ACABCDBCA',
  33: 'CBACCDBAABDD',
  34: 'CBBADCBDACDC',
  35: 'ABBAADCABDCC',
  36: 'ADCCADBACBCDB',
  37: 'BCABDBBADCAD',
  38: 'AACDDCBCBCADA',
  39: 'BCADBCDCDBCAAD',
  40: 'CADAD',
  41: 'ACBD',
  42: 'ADCBD',
  43: 'DBCDD',
  44: 'CDBBDACAB',
  45: 'CBDCDA',
  46: 'CBADBADCB',
  47: 'BADBCACCDBDA',
  48: 'BDABADCBDACBCCACA',
  49: 'DBBADCBADCBAACCBDA',
  50: 'DCBACDADB',
  51: 'BCADABDBCD',
  52: 'BCACDBCAD',
  53: 'CDADBACB',
  54: 'BBCCCAADCDD',
  55: 'BDBACDCA',
  56: 'ABCBDABCDC',
  57: 'BBACDDABB',
  58: 'BCDABDAAD',
  59: 'ABDBBCADCD',
  60: 'ACBDDABCB',
  61: 'ABDCDADBC',
  62: 'CABDBCA',
  63: 'ABCBDCDA',
  64: 'BCADCABDC',
  65: 'BCDABDCBAADBCCADB',
  66: 'CBDDBACADBACDDBBC',
  67: 'BABCCDACDBCABDADC',
  68: 'DCADBCCABB',
  69: 'CDBABADCBBAADC',
  70: 'CDABCDACABDACD',
  71: 'CDABCBADCDBA',
  72: 'DBACCAABDCBACDD',
  73: 'DBCDACADBACABBAC',
}

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  for (const [no, a] of Object.entries(ANSWERS)) {
    if (!/^[A-D]+$/.test(a)) throw new Error(`Geçersiz cevap dizisi: Test ${no} — ${a}`)
  }
  for (let n = 1; n <= 73; n += 1) if (!ANSWERS[n]) throw new Error(`Eksik test no: ${n}`)

  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const book = await pool
      .request()
      .input('id', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT id, name FROM dbo.ResourceBooks WHERE id = @id;')
    if (!book.recordset.length) throw new Error(`ResourceBook not found: ${RESOURCE_BOOK_ID}`)
    console.log(`Kaynak: ${book.recordset[0].name}\n`)

    const tests = await pool.request().input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID).query(`
      SELECT tt.id, tt.name, tt.page_start
      FROM dbo.ResourceBookTopicTests tt
      JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
      WHERE t.resource_book_id = @rbId;
    `)
    const byName = new Map(tests.recordset.map((r) => [r.name, r]))

    let updated = 0
    let keysInserted = 0

    for (const [no, answers] of Object.entries(ANSWERS)) {
      const testName = `Test ${no}`
      const rec = byName.get(testName)
      if (!rec) throw new Error(`Test bulunamadı: ${testName} (önce FAZ 1 script'i çalıştırılmalı)`)

      const questionCount = answers.length
      const pages = Math.max(1, Math.ceil(questionCount / 4))
      const pageStart = rec.page_start
      const pageEnd = pageStart + pages - 1

      await pool
        .request()
        .input('id', sql.UniqueIdentifier, rec.id)
        .input('qc', sql.Int, questionCount)
        .input('pe', sql.Int, pageEnd)
        .input('pc', sql.Int, pageEnd - pageStart + 1)
        .query('UPDATE dbo.ResourceBookTopicTests SET question_count = @qc, page_end = @pe, page_count = @pc WHERE id = @id;')

      await pool.request().input('id', sql.UniqueIdentifier, rec.id).query('DELETE FROM dbo.TestAnswerKeys WHERE test_id = @id;')

      const req = pool.request().input('testId', sql.UniqueIdentifier, rec.id)
      const rows = []
      answers.split('').forEach((label, idx) => {
        req.input(`o${idx}`, sql.Int, idx + 1)
        req.input(`l${idx}`, sql.NChar(1), label)
        rows.push(`(@testId, @o${idx}, @l${idx})`)
      })
      await req.query(`INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label) VALUES ${rows.join(', ')};`)

      updated += 1
      keysInserted += questionCount
      console.log(`${testName}: ${questionCount} soru (s. ${pageStart}-${pageEnd}) — ${answers}`)
    }

    console.log(`\nBitti. Güncellenen test: ${updated}, cevap anahtarı satırı: ${keysInserted}`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Fill failed')
  console.error(error)
  process.exit(1)
})
