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

// "Paragrafın Şifresi" (7. Sınıf). Bu script, İçindekiler'deki bir metot İçeriğinin altına
// kaynağın kendi cevap anahtarı sayfasından alınan testleri + çoktan seçmeli cevap anahtarını ekler.
//
// Sayfa numaraları: kaynak, cevap anahtarı sayfasında test bazında sayfa vermiyor. Testlerin
// panelde doğru sırada (Test 1 -> Test 2) görünmesi için sıralama alanı olan page_start dolu
// olmalı. Bu yüzden her testin page_start'ı, metodun İçindekiler'deki sayfa aralığından türetilir:
//   Test 1 = aralığın başlangıcı, Test 2 = aralığın ortası (yaklaşık; UI'dan düzeltilebilir).
// page_start'ı zaten dolu olan testlere (ör. ilk iki metot elle girilmiş) dokunulmaz.
const RESOURCE_BOOK_ID = 'F9639A95-BC60-4DF9-96F5-D80FC1161799'

// topic adı -> İçindekiler sayfa aralığı [start, end]
const TOC_RANGES = {
  '1. Söz Öbeği Metodu': [5, 11],
  '2. Cümlede Anlam Özelliği Metodu': [12, 20],
  '3. Anlam Bilgisi Metodu': [21, 28],
  '4. Deyim - Atasözü - Özdeyiş Metodu': [29, 35],
  '5. Yardımcı Düşünce Metodu': [36, 46],
  '6. Anahtar Sözcük Metodu': [47, 54],
  '7. Anlatım Özelliği Metodu': [55, 61],
  '8. Ana Düşünce Metodu': [62, 70],
  '9. Bakış Açısı ve İlişkilendirme Metodu': [71, 79],
  '10. Boşluk Tamamlama Metodu': [80, 86],
  '11. Özdeşlik Metodu': [87, 96],
  '12. Bağlantı Ögeleri Metodu': [97, 104],
  '13. Kavram Haritası Metodu': [105, 113],
  '14. Paragraf Oluşturma Metodu': [114, 120],
  '15. Konu Belirleme Metodu': [121, 128],
  '16. Kesinlik Metodu': [129, 135],
  '17. Sanatlı Söyleyiş Metodu': [136, 142],
  '18. Anlatım Biçimi/Düşünceyi Geliştirme Metodu': [143, 152],
  '19. Yanıt Paragrafı Metodu': [153, 162],
  '20. Metin Türleri Metodu': [163, 171],
  '21. Tablo ve Grafik Yorumlama': [172, 189],
  '22. Sözel Mantık Metodu': [190, 198],
  '23. Görsel Okuma Metodu': [199, 217],
}

// topic adı -> [{ name, answers }] (cevap anahtarı sayfasındaki sıra)
const TOPICS = {
  '3. Anlam Bilgisi Metodu': [
    { name: 'Test 1', answers: 'DDBCCCDBBDDD' },
    { name: 'Test 2', answers: 'BCABCDCBCACD' },
  ],
  '4. Deyim - Atasözü - Özdeyiş Metodu': [
    { name: 'Test 1', answers: 'CBADBDDCABCA' },
    { name: 'Test 2', answers: 'CDBAABDCBAAC' },
  ],
  '5. Yardımcı Düşünce Metodu': [
    { name: 'Test 1', answers: 'ADBCCCBADCCB' },
    { name: 'Test 2', answers: 'DCBCBDABDDCC' },
  ],
  '6. Anahtar Sözcük Metodu': [
    { name: 'Test 1', answers: 'DBBBABACBBCA' },
    { name: 'Test 2', answers: 'BDCAAABCCABD' },
  ],
  '7. Anlatım Özelliği Metodu': [
    { name: 'Test 1', answers: 'BADACCCADBDC' },
    { name: 'Test 2', answers: 'BBCBDBCDCCDC' },
  ],
  '8. Ana Düşünce Metodu': [
    { name: 'Test 1', answers: 'BDDACAAACABD' },
    { name: 'Test 2', answers: 'DAACDACABBDC' },
  ],
  '9. Bakış Açısı ve İlişkilendirme Metodu': [
    { name: 'Test 1', answers: 'BABDACBDCBBA' },
    { name: 'Test 2', answers: 'CACBCDACDCAD' },
  ],
  '10. Boşluk Tamamlama Metodu': [
    { name: 'Test 1', answers: 'CBDDBDBCDABC' },
    { name: 'Test 2', answers: 'ACCADACBDCAA' },
  ],
  '11. Özdeşlik Metodu': [
    { name: 'Test 1', answers: 'BADADADADBCB' },
    { name: 'Test 2', answers: 'DCACCDCCBDDA' },
  ],
  '12. Bağlantı Ögeleri Metodu': [
    { name: 'Test 1', answers: 'BAACCCBCDACB' },
    { name: 'Test 2', answers: 'CCCCADBADCDA' },
  ],
  '13. Kavram Haritası Metodu': [
    { name: 'Test 1', answers: 'DAAADCABADCB' },
    { name: 'Test 2', answers: 'BADACBACADBD' },
  ],
  '14. Paragraf Oluşturma Metodu': [
    { name: 'Test 1', answers: 'CBBCDBABABAC' },
    { name: 'Test 2', answers: 'ABBBDCCCDADC' },
  ],
  '15. Konu Belirleme Metodu': [
    { name: 'Test 1', answers: 'DADCCDACCBCA' },
    { name: 'Test 2', answers: 'DACBBCDBDBDC' },
  ],
  '16. Kesinlik Metodu': [
    { name: 'Test 1', answers: 'CDCCACADCCBD' },
    { name: 'Test 2', answers: 'BAADCCBDDBAB' },
  ],
  '17. Sanatlı Söyleyiş Metodu': [
    { name: 'Test 1', answers: 'DDABDACBADCA' },
    { name: 'Test 2', answers: 'BCBBCADCBBDC' },
  ],
  // Test 2'nin 1. sorusu kaynakta "2.A" olarak basılmış (dizgi hatası) — 1. soru = A.
  '18. Anlatım Biçimi/Düşünceyi Geliştirme Metodu': [
    { name: 'Test 1', answers: 'ADDDBDDDADCD' },
    { name: 'Test 2', answers: 'ACBCABDCBADC' },
  ],
  '19. Yanıt Paragrafı Metodu': [
    { name: 'Test 1', answers: 'ABDDCBACBDCD' },
    { name: 'Test 2', answers: 'BACABDDDACBC' },
  ],
  '20. Metin Türleri Metodu': [
    { name: 'Test 1', answers: 'BCDCDADCABDC' },
    { name: 'Test 2', answers: 'DBCCDBAACDBD' },
  ],
  '21. Tablo ve Grafik Yorumlama': [
    { name: 'Test 1', answers: 'CADCBCACDCDD' },
    { name: 'Test 2', answers: 'BBADCACCBDBD' },
  ],
  '22. Sözel Mantık Metodu': [
    { name: 'Test 1', answers: 'DCBCABCBDDDD' },
    { name: 'Test 2', answers: 'BBDDBCDAADBC' },
  ],
  '23. Görsel Okuma Metodu': [
    { name: 'Test 1', answers: 'BDCDBDBABDBC' },
    { name: 'Test 2', answers: 'BDABCAADABDB' },
  ],
}

// idx. testin page_start'ı: aralığın başından, testler aralığa eşit aralıklarla yayılmış gibi.
// 2 test için: idx 0 -> start, idx 1 -> start + floor(span/2).
function pageStartFor(topicName, idx, testCount) {
  const range = TOC_RANGES[topicName]
  if (!range) return null
  const [start, end] = range
  const span = end - start + 1
  return start + Math.floor((idx * span) / testCount)
}

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  for (const [topicName, tests] of Object.entries(TOPICS)) {
    if (!TOC_RANGES[topicName]) throw new Error(`TOC_RANGES eksik: ${topicName}`)
    for (const t of tests) {
      if (!/^[A-D]+$/.test(t.answers)) throw new Error(`Geçersiz cevap dizisi: ${topicName} / ${t.name} — ${t.answers}`)
    }
  }

  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    let testsCreated = 0
    let keysInserted = 0
    let pagesBackfilled = 0
    let skipped = 0

    for (const [topicName, tests] of Object.entries(TOPICS)) {
      const topic = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
        .input('name', sql.NVarChar(200), topicName)
        .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId AND name = @name;')
      if (!topic.recordset.length) throw new Error(`İçerik bulunamadı: ${topicName}`)
      if (topic.recordset.length > 1) throw new Error(`Aynı adlı birden fazla İçerik: ${topicName}`)
      const topicId = topic.recordset[0].id

      for (let idx = 0; idx < tests.length; idx += 1) {
        const t = tests[idx]
        const questionCount = t.answers.length
        const pageStart = pageStartFor(topicName, idx, tests.length)

        const existing = await pool
          .request()
          .input('topicId', sql.UniqueIdentifier, topicId)
          .input('name', sql.NVarChar(200), t.name)
          .query(`
            SELECT tt.id, tt.question_count, tt.page_start,
              (SELECT COUNT(*) FROM dbo.TestAnswerKeys k WHERE k.test_id = tt.id) AS answer_count
            FROM dbo.ResourceBookTopicTests tt
            WHERE tt.topic_id = @topicId AND tt.name = @name;
          `)
        if (existing.recordset.length > 1) throw new Error(`Aynı adlı birden fazla test: ${topicName} / ${t.name}`)

        let testId
        if (existing.recordset.length === 1) {
          const row = existing.recordset[0]
          testId = row.id
          if (row.question_count !== questionCount) {
            await pool
              .request()
              .input('id', sql.UniqueIdentifier, testId)
              .input('count', sql.Int, questionCount)
              .query('UPDATE dbo.ResourceBookTopicTests SET question_count = @count WHERE id = @id;')
          }
          if (row.page_start === null && pageStart !== null) {
            await pool
              .request()
              .input('id', sql.UniqueIdentifier, testId)
              .input('pageStart', sql.Int, pageStart)
              .query('UPDATE dbo.ResourceBookTopicTests SET page_start = @pageStart WHERE id = @id;')
            pagesBackfilled += 1
            console.log(`${topicName} / ${t.name}: page_start -> ${pageStart} (sıralama için)`)
          }
          if (row.answer_count > 0) {
            console.log(`${topicName} / ${t.name}: test + cevap anahtarı zaten var, atlanıyor.`)
            skipped += 1
            continue
          }
          console.log(`${topicName} / ${t.name}: test var, cevap anahtarı ekleniyor.`)
        } else {
          const ins = await pool
            .request()
            .input('topicId', sql.UniqueIdentifier, topicId)
            .input('topicName', sql.NVarChar(200), topicName)
            .input('name', sql.NVarChar(200), t.name)
            .input('pageStart', sql.Int, pageStart)
            .input('questionCount', sql.Int, questionCount)
            .query(`
              INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_start, page_end, page_count, question_count)
              OUTPUT inserted.id
              VALUES (@topicId, @topicName, @name, @pageStart, NULL, 1, @questionCount);
            `)
          testId = ins.recordset[0].id
          testsCreated += 1
          console.log(`${topicName} / ${t.name}: test oluşturuldu (${questionCount} soru, sayfa ~${pageStart}).`)
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
        console.log(`  cevap anahtarı: ${t.answers.split('').map((l, i) => `${i + 1}${l}`).join(' ')}`)
      }
    }

    console.log(
      `\nBitti. Yeni test: +${testsCreated}, cevap anahtarı: +${keysInserted}, page_start dolduruldu: ${pagesBackfilled}, atlanan: ${skipped}`,
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
