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

// "MEB 2027 Böyle Sorar Soru Bankası - Türkçe - 8. Sınıf"
//
// Soru metni YOK — sadece İÇERİK (Konu) + TEST ADI + SAYFA + cevap anahtarı eklenir.
// Kitap 11 "Konu"dan oluşuyor; 5. Konu (Dil Bilgisi) 4 alt başlığa (Fiilimsi, Cümlenin
// Ögeleri, Fiilde Çatı, Cümle Türleri) ayrılıyor ve her biri kendi Test 1-3 numaralamasına
// sahip, bu yüzden bu 4 alt başlık ayrı İçerik (ResourceBookTopic) olarak eklendi.
//
// page      : İÇİNDEKİLER'deki her testin başlangıç sayfası (bazı alt başlıklarda üçüncü
//              testin sayfası taramada net görünmediği için komşu değerlerden orantılı
//              tahmin edildi — "sayfa no'ları orantılı tahmin" pratiği, bkz. MEB2027 Fen8/İnkılap8).
// answers   : kitabın "Yanıt Anahtarı" bölümünden (s. 284) transkribe edildi; her test 20 soru.
//
// İdempotent: var olan İçerik/test/cevap anahtarını atlar; eksik cevap anahtarını tamamlar.
const RESOURCE_BOOK_ID = '8F9C1AA1-9316-46E5-BE6D-3E810E6D2D3B'

const KONULAR = [
  {
    name: '1. Konu: Sözcükte Anlam',
    lastPageGap: 4,
    tests: [
      { no: 1, page: 5, answers: 'ABCABDBACDACABDDCDBD' },
      { no: 2, page: 9, answers: 'DDACCABCBBBCDAADDADC' },
      { no: 3, page: 13, answers: 'DACBDACDCAABCBABDACD' },
      { no: 4, page: 17, answers: 'CBDBCBBADBDACABCBDCA' },
      { no: 5, page: 21, answers: 'DAACABCADBDCABBCDDBC' },
      { no: 6, page: 25, answers: 'ACDBBADBCDBDCABCADAC' },
    ],
  },
  {
    name: '2. Konu: Cümlede Anlam',
    lastPageGap: 4,
    tests: [
      { no: 1, page: 35, answers: 'BDBADBDADCBDBBCAACAA' },
      { no: 2, page: 39, answers: 'ABBDCDDBCADBDABACBAC' },
      { no: 3, page: 43, answers: 'ADCDCABDBACCBDADCAAB' },
      { no: 4, page: 47, answers: 'ABDBBBACDCCCABCABDCD' },
      { no: 5, page: 51, answers: 'ABBADCBDCADADDCBCABC' },
      { no: 6, page: 55, answers: 'CADBAABCBDBCADDCBCDA' },
    ],
  },
  {
    name: '3. Konu: Paragraf',
    lastPageGap: 6,
    tests: [
      { no: 1, page: 61, answers: 'CBAADACBCDBAADBDDACB' },
      { no: 2, page: 66, answers: 'ADBCBCADDADBCADBCACB' },
      { no: 3, page: 71, answers: 'ABABCBADABBCDCCDCDDA' },
      { no: 4, page: 75, answers: 'ACADADDABCBAADBDCDCC' },
      { no: 5, page: 80, answers: 'BADCDCADBABCCBCBDAAD' },
      { no: 6, page: 85, answers: 'ABBDDBDBAACBBABCADCA' },
      { no: 7, page: 90, answers: 'CDBAACBDCBDCDAABBADC' },
    ],
  },
  {
    name: '4. Konu: Anlatım Bilgileri',
    lastPageGap: 5,
    tests: [
      { no: 1, page: 97, answers: 'CDDBADBACDACBDCAAAAC' },
      { no: 2, page: 101, answers: 'CBCACDABCBAADCDBACDB' },
      { no: 3, page: 106, answers: 'ACCBCBDBDADBDCBADAAC' },
    ],
  },
  {
    name: '5. Konu: Dil Bilgisi - Fiilimsi (Eylemsi)',
    lastPageGap: 4,
    tests: [
      { no: 1, page: 113, answers: 'BCDABBADDCDBABACCDCA' },
      { no: 2, page: 117, answers: 'DDABDBDCBDBCAACAADCC' },
      { no: 3, page: 121, answers: 'ACBABDADDCCACBCDABDB' },
    ],
  },
  {
    name: '5. Konu: Dil Bilgisi - Cümlenin Ögeleri',
    lastPageGap: 4,
    tests: [
      { no: 1, page: 125, answers: 'ACBDADBCCBABDACBDCBD' },
      { no: 2, page: 129, answers: 'ACDBBDCCCACADBABDADB' },
      { no: 3, page: 133, answers: 'CBADDBDAADBCCACCBADB' },
    ],
  },
  {
    name: '5. Konu: Dil Bilgisi - Fiilde Çatı',
    lastPageGap: 1,
    tests: [
      { no: 1, page: 141, answers: 'CAACDCCABBDBDCBBDDAA' },
      { no: 2, page: 145, answers: 'BCDBDBDCABACDAAACBCD' },
      { no: 3, page: 148, answers: 'CAADCACBCDBADBADBCBD' },
    ],
  },
  {
    name: '5. Konu: Dil Bilgisi - Cümle Türleri',
    lastPageGap: 2,
    tests: [
      { no: 1, page: 153, answers: 'ABBDCBDCADCACBACBDDA' },
      { no: 2, page: 157, answers: 'DCABADBBDADCBABCDCCA' },
      { no: 3, page: 161, answers: 'DCBAADDCBCCABABBCDAD' },
    ],
  },
  {
    name: '6. Konu: Yazım Kuralları',
    lastPageGap: 2,
    tests: [
      { no: 1, page: 167, answers: 'DAACCDBACDBDBDACBACB' },
      { no: 2, page: 171, answers: 'AADBDADCBCBBBCCADDCA' },
      { no: 3, page: 175, answers: 'ABDCADCCDDBDBAABACCB' },
    ],
  },
  {
    name: '7. Konu: Noktalama İşaretleri',
    lastPageGap: 2,
    tests: [
      { no: 1, page: 181, answers: 'DADCADABCCBCACBDBBAD' },
      { no: 2, page: 185, answers: 'CCBDDADBDACBBAACABDC' },
      { no: 3, page: 189, answers: 'ABDDBDDCCBABCBCAACDA' },
    ],
  },
  {
    name: '8. Konu: Anlatım Bozuklukları',
    lastPageGap: 2,
    tests: [
      { no: 1, page: 195, answers: 'CBACACBCABCDABBDDCAD' },
      { no: 2, page: 199, answers: 'CACAADBDCBBDDCABCABD' },
      { no: 3, page: 203, answers: 'CACDABABCDBADBDACABC' },
    ],
  },
  {
    name: '9. Konu: Düzyazı Türleri',
    lastPageGap: 1,
    tests: [
      { no: 1, page: 211, answers: 'BCDDBCDADABBDACABCAA' },
      { no: 2, page: 217, answers: 'CADACDBDACABABCBCABB' },
      { no: 3, page: 222, answers: 'BAABDCCBDBADACADDCDC' },
    ],
  },
  {
    name: '10. Konu: Mantık Muhakeme',
    lastPageGap: 2,
    tests: [
      { no: 1, page: 229, answers: 'BACDBBDACADBCACDACAD' },
      { no: 2, page: 235, answers: 'CADABCACBCDDABBDACDB' },
      { no: 3, page: 241, answers: 'CADBCBACCABBDADBDADC' },
    ],
  },
  {
    name: '11. Konu: Görsel Yorumlama - Grafik Değerlendirme',
    lastPageGap: 9,
    tests: [
      { no: 1, page: 253, answers: 'DACBBADDACBDAACDCABC' },
      { no: 2, page: 269, answers: 'CBCCDADDBABADCDBBCAA' },
      { no: 3, page: 275, answers: 'DACBCCDACDCDABBADAAB' },
    ],
  },
]

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  // Ön doğrulama
  for (const konu of KONULAR) {
    const seen = new Set()
    for (const t of konu.tests) {
      if (seen.has(t.no)) throw new Error(`${konu.name}: mükerrer test no ${t.no}`)
      seen.add(t.no)
      if (!/^[A-D]{20}$/.test(t.answers)) throw new Error(`${konu.name} / Test ${t.no}: geçersiz cevap dizisi "${t.answers}"`)
      if (!Number.isInteger(t.page) || t.page <= 0) throw new Error(`${konu.name} / Test ${t.no}: geçersiz sayfa`)
    }
    const sorted = [...konu.tests].sort((a, b) => a.no - b.no)
    sorted.forEach((t, i) => {
      const next = sorted[i + 1]
      t.pageEnd = next ? Math.max(t.page, next.page - 1) : t.page + konu.lastPageGap - 1
    })
  }

  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const book = await pool
      .request()
      .input('id', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT id, name, scope, grade FROM dbo.ResourceBooks WHERE id = @id;')
    if (!book.recordset.length) throw new Error(`ResourceBook not found: ${RESOURCE_BOOK_ID}`)
    const b = book.recordset[0]
    console.log(`Kaynak: ${b.name} (scope=${b.scope}, ${b.grade}. sınıf)\n`)

    let topicsCreated = 0
    let topicsSkipped = 0
    let testsCreated = 0
    let testsSkipped = 0
    let keysInserted = 0

    for (const konu of KONULAR) {
      let topicId
      const existingTopic = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
        .input('name', sql.NVarChar(200), konu.name)
        .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId AND name = @name;')
      if (existingTopic.recordset.length > 1) throw new Error(`Aynı adlı birden fazla İçerik: ${konu.name}`)
      if (existingTopic.recordset.length === 1) {
        topicId = existingTopic.recordset[0].id
        topicsSkipped += 1
        console.log(`İçerik (var): ${konu.name}`)
      } else {
        const ins = await pool
          .request()
          .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
          .input('name', sql.NVarChar(200), konu.name)
          .query('INSERT INTO dbo.ResourceBookTopics (resource_book_id, name) OUTPUT inserted.id VALUES (@rbId, @name);')
        topicId = ins.recordset[0].id
        topicsCreated += 1
        console.log(`İçerik (yeni): ${konu.name}`)
      }

      for (const t of konu.tests) {
        const testName = `Test ${t.no}`
        const questionCount = t.answers.length

        const existingTest = await pool
          .request()
          .input('topicId', sql.UniqueIdentifier, topicId)
          .input('name', sql.NVarChar(200), testName)
          .query(`
            SELECT tt.id,
              (SELECT COUNT(*) FROM dbo.TestAnswerKeys k WHERE k.test_id = tt.id) AS answer_count
            FROM dbo.ResourceBookTopicTests tt
            WHERE tt.topic_id = @topicId AND tt.name = @name;
          `)
        if (existingTest.recordset.length > 1) throw new Error(`Aynı adlı birden fazla test: ${konu.name} / ${testName}`)

        let testId
        if (existingTest.recordset.length === 1) {
          const row = existingTest.recordset[0]
          testId = row.id
          await pool
            .request()
            .input('id', sql.UniqueIdentifier, testId)
            .input('qc', sql.Int, questionCount)
            .input('ps', sql.Int, t.page)
            .input('pe', sql.Int, t.pageEnd)
            .input('pc', sql.Int, t.pageEnd - t.page + 1)
            .query('UPDATE dbo.ResourceBookTopicTests SET question_count = @qc, page_start = @ps, page_end = @pe, page_count = @pc WHERE id = @id;')
          if (row.answer_count > 0) {
            testsSkipped += 1
            console.log(`  ${testName}: var (cevap anahtarı zaten yazılı), atlandı`)
            continue
          }
          console.log(`  ${testName}: test var, cevap anahtarı ekleniyor`)
        } else {
          const ins = await pool
            .request()
            .input('topicId', sql.UniqueIdentifier, topicId)
            .input('topicName', sql.NVarChar(200), konu.name)
            .input('name', sql.NVarChar(200), testName)
            .input('ps', sql.Int, t.page)
            .input('pe', sql.Int, t.pageEnd)
            .input('pc', sql.Int, t.pageEnd - t.page + 1)
            .input('qc', sql.Int, questionCount)
            .query(`
              INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_start, page_end, page_count, question_count)
              OUTPUT inserted.id
              VALUES (@topicId, @topicName, @name, @ps, @pe, @pc, @qc);
            `)
          testId = ins.recordset[0].id
          testsCreated += 1
          console.log(`  ${testName}: oluşturuldu (${questionCount} soru, s. ${t.page}-${t.pageEnd})`)
        }

        const req = pool.request().input('testId', sql.UniqueIdentifier, testId)
        const valueRows = []
        t.answers.split('').forEach((label, i) => {
          req.input(`o${i}`, sql.Int, i + 1)
          req.input(`l${i}`, sql.NChar(1), label)
          valueRows.push(`(@testId, @o${i}, @l${i})`)
        })
        await req.query(`INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label) VALUES ${valueRows.join(', ')};`)
        keysInserted += 1
        console.log(`    cevap anahtarı: ${t.answers}`)
      }
    }

    console.log(
      `\nBitti. Yeni İçerik: +${topicsCreated} (var: ${topicsSkipped}), ` +
        `yeni test: +${testsCreated} (cevap anahtarı zaten olan: ${testsSkipped}), cevap anahtarı yazılan: +${keysInserted}`,
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
