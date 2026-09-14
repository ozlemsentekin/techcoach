// "LGS Paragraf Soru Bankası - Sözel Mantık ve Muhakeme" (Tudem) kaynağına kullanıcının
// gönderdiği içindekiler + "Yanıt Anahtarı" (Sayfa No bazlı) fotoğraflarından 6 Ünite konusu +
// "Deneme Sınavları" konusu, toplam 62 test ve tam cevap anahtarını birlikte oluşturur.
// page_start = içindekiler'deki sayfa no; page_end = bir sonraki kaydın sayfası - 1 (son test
// için 239'daki "Yanıtlar" bölümünden önceki sayfa). question_count = cevap anahtarındaki
// gerçek soru sayısı (Sayfa No satırındaki dolu hücre sayısı).
const fs = require('fs')
const path = require('path')
const sql = require('mssql')

function loadLocalSettings() {
  const p = path.join(__dirname, '..', 'local.settings.json')
  const parsed = JSON.parse(fs.readFileSync(p, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([k, v]) => {
    if (!process.env[k] && typeof v === 'string') process.env[k] = v
  })
}

const RESOURCE_BOOK_ID = '8E6E91B7-0F0C-47A8-8DD7-80E1ACB65B31'

const TOPICS = [
  {
    name: '1. Ünite - Paragrafta Anlam',
    tests: [
      { name: 'Isınma Turu - Başlık, Konu, Anahtar Sözcük', page: 6, answers: 'BDBCCB' },
      { name: 'Ritmi Yakala - Başlık, Konu, Anahtar Sözcük', page: 8, answers: 'BDBDBCABCCAA' },
      { name: 'Tam LGS Ayarı - Başlık, Konu, Anahtar Sözcük', page: 12, answers: 'BABDCBCDBCDD' },
      { name: 'Isınma Turu - Ana Düşünce, Ana Duygu, Tema', page: 16, answers: 'BADBCA' },
      { name: 'Ritmi Yakala - Ana Düşünce, Ana Duygu, Tema', page: 18, answers: 'CBCDADCABCB' },
      { name: 'Tam LGS Ayarı - Ana Düşünce, Ana Duygu, Tema', page: 22, answers: 'DBDBADDCACD' },
      { name: 'Isınma Turu - Yardımcı Düşünce', page: 26, answers: 'DCDBB' },
      { name: 'Ritmi Yakala - Yardımcı Düşünce', page: 28, answers: 'CBCDCCBAAC' },
      { name: 'Tam LGS Ayarı - Yardımcı Düşünce', page: 32, answers: 'ACBDDCBDCA' },
      { name: 'Isınma Turu-1 - Paragraf Yorumu', page: 36, answers: 'BCDDCBA' },
      { name: 'Isınma Turu-2 - Paragraf Yorumu', page: 38, answers: 'BCDCB' },
      { name: 'Ritmi Yakala-1 - Paragraf Yorumu', page: 40, answers: 'ACACCDCDBAAC' },
      { name: 'Ritmi Yakala-2 - Paragraf Yorumu', page: 44, answers: 'CDBACDCAABDC' },
      { name: 'Ritmi Yakala-3 - Paragraf Yorumu', page: 48, answers: 'BDABCBDCBBD' },
      { name: 'Tam LGS Ayarı-1 - Paragraf Yorumu', page: 52, answers: 'BBADBCCCDBB' },
      { name: 'Tam LGS Ayarı-2 - Paragraf Yorumu', page: 56, answers: 'CDABCDBDADAC' },
      { name: 'Tam LGS Ayarı-3 - Paragraf Yorumu', page: 60, answers: 'DCAADDCBBCADCD' },
    ],
  },
  {
    name: '2. Ünite - Paragrafta Anlatım',
    tests: [
      { name: 'Isınma Turu - Anlatım Biçimleri', page: 66, answers: 'ACDACA' },
      { name: 'Ritmi Yakala - Anlatım Biçimleri', page: 68, answers: 'ABCDDCABCC' },
      { name: 'Tam LGS Ayarı - Anlatım Biçimleri', page: 72, answers: 'BBCCADACDD' },
      { name: 'Isınma Turu - Düşünceyi Geliştirme Yolları', page: 76, answers: 'DDBDBA' },
      { name: 'Ritmi Yakala - Düşünceyi Geliştirme Yolları', page: 78, answers: 'DCADBBCADDC' },
      { name: 'Tam LGS Ayarı - Düşünceyi Geliştirme Yolları', page: 82, answers: 'BDDCADBCCA' },
      { name: 'Isınma Turu - Dil ve Anlatım Özellikleri, Paragrafta Anlatıcı', page: 86, answers: 'BBACBCB' },
      { name: 'Ritmi Yakala - Dil ve Anlatım Özellikleri, Paragrafta Anlatıcı', page: 88, answers: 'ADAACBCAACBB' },
      { name: 'Tam LGS Ayarı - Dil ve Anlatım Özellikleri, Paragrafta Anlatıcı', page: 92, answers: 'DCACDBDBADBAD' },
    ],
  },
  {
    name: '3. Ünite - Paragrafın Yapısı',
    tests: [
      { name: 'Isınma Turu - Giriş, Gelişme, Sonuç', page: 98, answers: 'CDADBC' },
      { name: 'Ritmi Yakala - Giriş, Gelişme, Sonuç', page: 100, answers: 'AACCBDABDA' },
      { name: 'Tam LGS Ayarı - Giriş, Gelişme, Sonuç', page: 104, answers: 'CBDAABCBADC' },
      { name: 'Isınma Turu - Paragraf Oluşturma, Paragraf Tamamlama', page: 108, answers: 'BACBCD' },
      { name: 'Ritmi Yakala - Paragraf Oluşturma, Paragraf Tamamlama', page: 110, answers: 'CABDACDBABDB' },
      { name: 'Tam LGS Ayarı-1 - Paragraf Oluşturma, Paragraf Tamamlama', page: 114, answers: 'ABDCDDCBDCA' },
      { name: 'Tam LGS Ayarı-2 - Paragraf Oluşturma, Paragraf Tamamlama', page: 118, answers: 'ABDCBDDABABD' },
      { name: 'Isınma Turu - Paragraf Bölme, Akışı Bozan Cümle', page: 122, answers: 'CCCAACD' },
      { name: 'Ritmi Yakala - Paragraf Bölme, Akışı Bozan Cümle', page: 124, answers: 'BCDCBCBCBBC' },
      { name: 'Tam LGS Ayarı - Paragraf Bölme, Akışı Bozan Cümle', page: 128, answers: 'ABAACABACCB' },
    ],
  },
  {
    name: '4. Ünite - Görsel Okuma',
    tests: [
      { name: 'Isınma Turu - Tablo ve Grafik Okuma', page: 134, answers: 'ADB' },
      { name: 'Ritmi Yakala - Tablo ve Grafik Okuma', page: 136, answers: 'DCDDCA' },
      { name: 'Tam LGS Ayarı - Tablo ve Grafik Okuma', page: 140, answers: 'ADCBCBC' },
      { name: 'Isınma Turu - Görsele Bağlı Yorumlama', page: 144, answers: 'BDAAB' },
      { name: 'Ritmi Yakala - Görsele Bağlı Yorumlama', page: 146, answers: 'CDBCDB' },
      { name: 'Tam LGS Ayarı - Görsele Bağlı Yorumlama', page: 150, answers: 'CCDBADACDA' },
    ],
  },
  {
    name: '5. Ünite - Sözel Mantık ve Muhakeme',
    tests: [
      { name: 'Isınma Turu - Tablo Oluşturma, Okuma ve Yorumlama', page: 156, answers: 'CDBAB' },
      { name: 'Ritmi Yakala - Tablo Oluşturma, Okuma ve Yorumlama', page: 158, answers: 'DACBABDDCBDB' },
      { name: 'Tam LGS Ayarı - Tablo Oluşturma, Okuma ve Yorumlama', page: 162, answers: 'DBDDCCDBCC' },
      { name: 'Isınma Turu - Sıralama, Gruplama', page: 166, answers: 'CBCDAB' },
      { name: 'Ritmi Yakala-1 - Sıralama, Gruplama', page: 168, answers: 'CAABCC' },
      { name: 'Ritmi Yakala-2 - Sıralama, Gruplama', page: 170, answers: 'DBADDB' },
      { name: 'Tam LGS Ayarı - Sıralama, Gruplama', page: 172, answers: 'CCADCAABBDCA' },
      { name: 'Isınma Turu - Yer, Yön ve Konum Bulma', page: 176, answers: 'CBADAB' },
      { name: 'Ritmi Yakala - Yer, Yön ve Konum Bulma', page: 178, answers: 'ADACDA' },
      { name: 'Tam LGS Ayarı - Yer, Yön ve Konum Bulma', page: 180, answers: 'BCCDBDDBAA' },
      { name: 'Isınma Turu - Şifreleme', page: 184, answers: 'ABACA' },
      { name: 'Ritmi Yakala - Şifreleme', page: 186, answers: 'BDACDB' },
      { name: 'Tam LGS Ayarı - Şifreleme', page: 188, answers: 'DDCDBAADBADCBA' },
    ],
  },
  {
    name: '6. Ünite - Metin Türleri',
    tests: [
      { name: 'Isınma Turu - Metin Türleri', page: 194, answers: 'CDBACC' },
      { name: 'Ritmi Yakala - Metin Türleri', page: 196, answers: 'DCBBADCBCAC' },
      { name: 'Tam LGS Ayarı - Metin Türleri', page: 200, answers: 'DDCADCBCBCCAB' },
    ],
  },
  {
    name: 'Deneme Sınavları',
    tests: [
      { name: 'Deneme Sınavı-1', page: 206, answers: 'ABCADACBDBADCBDCCBDA' },
      { name: 'Deneme Sınavı-2', page: 214, answers: 'DBAADCDADCBCADADADCB' },
      { name: 'Deneme Sınavı-3', page: 222, answers: 'BDBADDBADCCBCCADABDA' },
      { name: 'Deneme Sınavı-4', page: 230, answers: 'BBDDADACDCCBDDADADBB' },
    ],
  },
]

// Yanıtlar (cevap anahtarı eki) 239'da başlıyor — son testin bitişi 238.
const BOOK_END_PAGE = 239

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING eksik.')

  // Global sıradaki testler + bir sonrakinin sayfasına göre page_end hesapla.
  const flat = []
  TOPICS.forEach((topic, topicIdx) => {
    topic.tests.forEach((test) => flat.push({ ...test, topicIdx }))
  })
  flat.forEach((test, idx) => {
    const nextPage = idx + 1 < flat.length ? flat[idx + 1].page : BOOK_END_PAGE
    test.pageEnd = nextPage - 1
    test.pageCount = test.pageEnd - test.page + 1
  })

  const pool = await sql.connect(connectionString)
  try {
    const existingTopics = await pool
      .request()
      .input('b', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT COUNT(*) AS cnt FROM dbo.ResourceBookTopics WHERE resource_book_id = @b;')
    if (existingTopics.recordset[0].cnt > 0) {
      throw new Error(`Bu kaynakta zaten ${existingTopics.recordset[0].cnt} konu var — script atlandı (mükerrer içerik riski).`)
    }

    let flatIdx = 0
    let topicCount = 0
    let testCount = 0
    let answerRows = 0

    for (const topic of TOPICS) {
      const topicResult = await pool
        .request()
        .input('b', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
        .input('name', sql.NVarChar(200), topic.name)
        .query('INSERT INTO dbo.ResourceBookTopics (resource_book_id, name) OUTPUT inserted.id VALUES (@b, @name);')
      const topicId = topicResult.recordset[0].id
      topicCount += 1
      console.log(`+ Konu: ${topic.name}`)

      for (const test of topic.tests) {
        const flatTest = flat[flatIdx]
        flatIdx += 1
        const answers = test.answers.split('')

        const testResult = await pool
          .request()
          .input('topicId', sql.UniqueIdentifier, topicId)
          .input('name', sql.NVarChar(200), test.name)
          .input('pageStart', sql.Int, test.page)
          .input('pageEnd', sql.Int, flatTest.pageEnd)
          .input('pageCount', sql.Int, flatTest.pageCount)
          .input('questionCount', sql.Int, answers.length)
          .query(`
            INSERT INTO dbo.ResourceBookTopicTests (topic_id, name, page_start, page_end, page_count, question_count)
            OUTPUT inserted.id
            VALUES (@topicId, @name, @pageStart, @pageEnd, @pageCount, @questionCount);
          `)
        const testId = testResult.recordset[0].id
        testCount += 1

        const request = pool.request().input('testId', sql.UniqueIdentifier, testId)
        const values = []
        answers.forEach((label, idx) => {
          request.input(`order${idx}`, sql.Int, idx + 1)
          request.input(`label${idx}`, sql.NChar(1), label)
          values.push(`(@testId, @order${idx}, @label${idx})`)
        })
        await request.query(`
          INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label)
          VALUES ${values.join(', ')};
        `)
        answerRows += answers.length
        console.log(`   + ${test.name} (s.${test.page}-${flatTest.pageEnd}): ${test.answers}`)
      }
    }

    console.log(`Bitti. ${topicCount} konu, ${testCount} test, ${answerRows} cevap satırı oluşturuldu.`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('İçerik/cevap anahtarı oluşturma başarısız')
  console.error(error)
  process.exit(1)
})
