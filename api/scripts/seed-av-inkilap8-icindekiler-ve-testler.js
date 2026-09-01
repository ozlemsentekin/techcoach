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

// "T.C. İnkılap Tarihi ve Atatürkçülük Soru Bankası 8" — Akıllı Versiyon (AV) Yayınları.
// scope = 'catalog' (Kütüphane). Bu script kaynağın İçindekiler'indeki 7 ünitenin tüm
// başlıklarını birer "İçerik" (ResourceBookTopic) olarak ekler, ardından kaynağın kendi
// cevap anahtarı sayfasından alınan testleri + çoktan seçmeli cevap anahtarını yazar.
//
// İçerik adı DB'de:  "<ünite no>. Ünite · <başlık>"  (panelde ünite bazında sıralı/gruplu görünsün diye)
// Testler panelde page_start'a göre sıralanır; cevap anahtarı sayfası her teste ayrı sayfa verdiği
// için page_start = testin gerçek sayfası.
//
// İdempotent: tekrar çalıştırılınca var olan İçerik/test/cevap anahtarını atlar, eksikleri tamamlar.
// Cevap anahtarı fotoğrafı sonradan gelen başlıklar için `tests: []` bırakıldı — görsel gelince
// ilgili başlığa test bloğu eklenip script yeniden çalıştırılır.
const RESOURCE_BOOK_ID = 'DCD6A8EA-3841-4149-9D11-E8D307BDB89C'

// tests[].answers: cevap anahtarındaki sırayla harf dizisi. question_count = dizinin uzunluğu.
const UNITS = [
  {
    no: 1,
    title: 'Bir Kahraman Doğuyor',
    topics: [
      {
        name: "Avrupa'daki Gelişmeler ve Osmanlı Devleti",
        tests: [
          { name: 'Test-1', page: 6, answers: 'CABBADA' },
          { name: 'Test-2', page: 8, answers: 'DBBA' },
        ],
      },
      {
        name: "Mustafa Kemal'in Çocukluk Dönemi ve Öğrenim Hayatı",
        tests: [
          { name: 'Test-3', page: 10, answers: 'AABADAB' },
          { name: 'Test-4', page: 12, answers: 'DACCC' },
        ],
      },
      {
        name: "Mustafa Kemal'in Askerlik Hayatı",
        tests: [
          { name: 'Test-5', page: 14, answers: 'BCABBBDBD' },
          { name: 'Test-6', page: 16, answers: 'BBDBBA' },
        ],
      },
      {
        name: 'Akıllı Değerlendirme Sınavı',
        tests: [
          { name: 'Test 1', page: 18, answers: 'CBACBBDCCD' },
          { name: 'Test 2', page: 22, answers: 'DDDCBAABAC' },
        ],
      },
    ],
  },
  {
    no: 2,
    title: 'Millî Uyanış',
    topics: [
      {
        name: "I. Dünya Savaşı'na Yol Açan Gelişmeler",
        tests: [
          { name: 'Test-1', page: 28, answers: 'DDCBDB' },
          { name: 'Test-2', page: 30, answers: 'DBCC' },
        ],
      },
      {
        name: "Osmanlı Devleti'nin Son Savaşı: I. Dünya Savaşı",
        tests: [
          { name: 'Test-3', page: 32, answers: 'ACDBBBC' },
          { name: 'Test-4', page: 34, answers: 'DCBC' },
        ],
      },
      {
        name: 'İşgal Yıllarında Anadolu: Mondros Ateşkes Antlaşması',
        tests: [
          { name: 'Test-5', page: 36, answers: 'CCDADDC' },
          { name: 'Test-6', page: 38, answers: 'ACDCB' },
        ],
      },
      {
        name: 'Cemiyetler ve Kuvayimillîye',
        tests: [
          { name: 'Test-7', page: 40, answers: 'DBBABCB' },
          { name: 'Test-8', page: 42, answers: 'DBA' },
        ],
      },
      {
        name: 'İstiklâl Yolculuğu',
        tests: [
          { name: 'Test-9', page: 44, answers: 'DCDABBC' },
          { name: 'Test-10', page: 46, answers: 'DC' },
        ],
      },
      {
        name: 'Bir Milletin Yemini: Misakımillî ve Büyük Millet Meclisinin Açılması',
        tests: [
          { name: 'Test-11', page: 48, answers: 'BCDDDAB' },
          { name: 'Test-12', page: 50, answers: 'BBADC' },
        ],
      },
      {
        name: 'Büyük Millet Meclisine Karşı Çıkan İsyanlar',
        tests: [
          { name: 'Test-13', page: 52, answers: 'DDCDACB' },
          { name: 'Test-14', page: 54, answers: 'DCABD' },
        ],
      },
      {
        name: 'Sevr Barış Antlaşması',
        tests: [
          { name: 'Test-15', page: 56, answers: 'ABACAAD' },
          { name: 'Test-16', page: 58, answers: 'BADBB' },
        ],
      },
      {
        name: 'Akıllı Değerlendirme Sınavı',
        tests: [
          { name: 'Test 1', page: 60, answers: 'BACDABDBDA' },
          { name: 'Test 2', page: 64, answers: 'BCADBDCDDD' },
          { name: 'Test 3', page: 70, answers: 'ADDCADCADA' },
        ],
      },
    ],
  },
  {
    no: 3,
    title: 'Millî Bir Destan: Ya İstiklal Ya Ölüm',
    topics: [
      {
        name: 'Doğu ve Güney Cepheleri',
        tests: [
          { name: 'Test-1', page: 76, answers: 'CCDBCAA' },
          { name: 'Test-2', page: 78, answers: 'ACB' },
        ],
      },
      {
        name: 'Batı Cephesi ve Maarif Kongresi',
        tests: [
          { name: 'Test-3', page: 80, answers: 'CDDBCDC' },
          { name: 'Test-4', page: 82, answers: 'DCBA' },
        ],
      },
      {
        name: 'Başkomutanlık Yasası ve Tekalif-i Millîye Emirleri',
        tests: [
          { name: 'Test-5', page: 84, answers: 'BCADBDD' },
          { name: 'Test-6', page: 86, answers: 'DBCA' },
        ],
      },
      {
        name: "Direnişten Dirilişe: Sakarya'dan Büyük Taarruz'a",
        tests: [
          { name: 'Test-7', page: 88, answers: 'BAABDCD' },
          { name: 'Test-8', page: 90, answers: 'CDADBC' },
        ],
      },
      {
        name: "Türkiye'nin Tapu Senedi: Lozan Barış Antlaşması",
        tests: [
          { name: 'Test-9', page: 92, answers: 'BDBDACC' },
          { name: 'Test-10', page: 94, answers: 'BADBB' },
        ],
      },
      {
        name: "Millî Mücadele'nin Sanata ve Edebiyata Yansımaları",
        tests: [
          { name: 'Test-11', page: 96, answers: 'DACDCDA' },
          { name: 'Test-12', page: 98, answers: 'DBDAB' },
        ],
      },
      {
        name: 'Akıllı Değerlendirme Sınavı',
        tests: [
          { name: 'Test 1', page: 100, answers: 'CBAABBAABA' },
          { name: 'Test 2', page: 104, answers: 'DBDBADBCCD' },
        ],
      },
    ],
  },
  {
    no: 4,
    title: 'Atatürkçülük ve Çağdaşlaşan Türkiye',
    topics: [
      {
        name: 'Atatürk İlkeleri',
        tests: [
          { name: 'Test-1', page: 110, answers: 'DBAACBBCB' },
          { name: 'Test-2', page: 112, answers: 'ABAD' },
        ],
      },
      {
        name: 'Siyasal Alanda Yapılan İnkılaplar',
        tests: [
          { name: 'Test-3', page: 114, answers: 'DCBABDAAC' },
          { name: 'Test-4', page: 116, answers: 'CDA' },
        ],
      },
      {
        name: 'Hukuk Alanında Yapılan İnkılaplar',
        tests: [
          { name: 'Test-5', page: 118, answers: 'ACCBDDBC' },
          { name: 'Test-6', page: 120, answers: 'BBDA' },
        ],
      },
      {
        name: 'Eğitim ve Kültür Alanında Yapılan İnkılaplar',
        tests: [
          { name: 'Test-7', page: 122, answers: 'BADBDDC' },
          { name: 'Test-8', page: 124, answers: 'ADBCC' },
        ],
      },
      {
        name: 'Toplumsal Alanda Yapılan İnkılaplar',
        tests: [
          { name: 'Test-9', page: 126, answers: 'DBBAACDDB' },
          // Kaynakta "Test-108" basılmış (dizgi hatası) — Test-10.
          { name: 'Test-10', page: 128, answers: 'BDBCCB' },
        ],
      },
      {
        name: 'Ekonomi Alanında Yapılan İnkılaplar',
        tests: [
          { name: 'Test-11', page: 130, answers: 'DABDCACBA' },
          { name: 'Test-12', page: 132, answers: 'DABB' },
        ],
      },
      {
        name: "Atatürk'ün Gösterdiği Hedefler, Atatürk ve Sağlık",
        tests: [
          { name: 'Test-13', page: 134, answers: 'CBADDAAD' },
          { name: 'Test-14', page: 136, answers: 'DBAD' },
        ],
      },
      {
        name: 'İlelebet Cumhuriyet',
        tests: [
          { name: 'Test-15', page: 138, answers: 'DCBBCBA' },
          { name: 'Test-16', page: 140, answers: 'CADD' },
        ],
      },
      {
        name: 'Atatürk İlke ve İnkılaplarını Oluşturan Temel Esaslar',
        tests: [
          { name: 'Test-17', page: 142, answers: 'DBCAAABCB' },
          { name: 'Test-18', page: 144, answers: 'DBCDC' },
        ],
      },
      {
        name: 'Akıllı Değerlendirme Sınavı',
        tests: [
          { name: 'Test 1', page: 146, answers: 'AADAACADCB' },
          { name: 'Test 2', page: 150, answers: 'BDADDCACBB' },
          { name: 'Test 3', page: 154, answers: 'CADABCDBAD' },
        ],
      },
    ],
  },
  {
    no: 5,
    title: 'Demokratikleşme Çabaları',
    topics: [
      {
        name: 'Demokratikleşme Yolunda Atılan Adımlar',
        tests: [
          { name: 'Test-1', page: 160, answers: 'DCBCBDC' },
          { name: 'Test-2', page: 162, answers: 'DBCAC' },
        ],
      },
      {
        name: "Mustafa Kemal'e Suikast Girişimi, Türkiye Cumhuriyeti'ne Yönelik Tehditler",
        tests: [
          { name: 'Test-3', page: 164, answers: 'DBADCD' },
          { name: 'Test-4', page: 166, answers: 'DCCDB' },
        ],
      },
      {
        name: 'Akıllı Değerlendirme Sınavı',
        tests: [
          { name: 'Test 1', page: 168, answers: 'AACDDBDBDA' },
        ],
      },
    ],
  },
  {
    no: 6,
    title: 'Atatürk Dönemi Türk Dış Politikası',
    topics: [
      {
        name: 'Türk Dış Politikasının Temel İlke ve Amaçları',
        tests: [
          { name: 'Test-1', page: 174, answers: 'ADCDACA' },
          { name: 'Test-2', page: 176, answers: 'CACB' },
        ],
      },
      {
        name: "Türk Dış Politikasında Yaşanan Gelişmeler ve Hatay'ın Türkiye'ye Katılması",
        tests: [
          { name: 'Test-3', page: 178, answers: 'BCDCCDA' },
          { name: 'Test-4', page: 180, answers: 'BDB' },
        ],
      },
      {
        name: 'Akıllı Değerlendirme Sınavı',
        tests: [
          { name: 'Test 1', page: 182, answers: 'BBCADBCCDC' },
        ],
      },
    ],
  },
  {
    no: 7,
    title: "Atatürk'ün Ölümü ve Sonrası",
    topics: [
      {
        name: "Atatürk'ün Vefatı, Vefatı'nın Yankıları ve İnsan Eserleriyle Yaşar",
        tests: [
          { name: 'Test-1', page: 188, answers: 'ADCABD' },
          { name: 'Test-2', page: 190, answers: 'DBBCA' },
        ],
      },
      {
        name: "Yeniden Sarsılan Dünya: II. Dünya Savaşı ve Savaşın Türkiye'ye Etkileri",
        tests: [
          { name: 'Test-3', page: 192, answers: 'BDCBBDB' },
          { name: 'Test-4', page: 194, answers: 'ACCDC' },
        ],
      },
      {
        name: 'Demokrasi Yolunda Güçlü Adımlar',
        tests: [
          { name: 'Test-5', page: 196, answers: 'BDCBDCA' },
          { name: 'Test-6', page: 198, answers: 'ABCCD' },
        ],
      },
      {
        name: 'Akıllı Değerlendirme Sınavı',
        tests: [
          { name: 'Test 1', page: 200, answers: 'CDBCADCAAA' },
        ],
      },
    ],
  },
]

function topicDbName(unitNo, topicName) {
  return `${unitNo}. Ünite · ${topicName}`
}

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  // Ön doğrulama
  for (const u of UNITS) {
    for (const t of u.topics) {
      for (const test of t.tests) {
        if (!/^[A-E]+$/.test(test.answers)) {
          throw new Error(`Geçersiz cevap dizisi: ${u.no}/${t.name}/${test.name} — ${test.answers}`)
        }
        if (!Number.isInteger(test.page) || test.page <= 0) {
          throw new Error(`Geçersiz sayfa: ${u.no}/${t.name}/${test.name}`)
        }
      }
    }
  }

  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const book = await pool
      .request()
      .input('id', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT id, name, scope, grade FROM dbo.ResourceBooks WHERE id = @id;')
    if (!book.recordset.length) throw new Error(`ResourceBook not found: ${RESOURCE_BOOK_ID}`)
    const b = book.recordset[0]
    console.log(`ResourceBook: ${b.name} (scope=${b.scope}, ${b.grade}. sınıf)\n`)

    let topicsCreated = 0
    let topicsSkipped = 0
    let testsCreated = 0
    let testsSkipped = 0
    let keysInserted = 0

    for (const u of UNITS) {
      for (const t of u.topics) {
        const name = topicDbName(u.no, t.name)

        let topicId
        const existingTopic = await pool
          .request()
          .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
          .input('name', sql.NVarChar(200), name)
          .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId AND name = @name;')
        if (existingTopic.recordset.length > 1) throw new Error(`Aynı adlı birden fazla İçerik: ${name}`)
        if (existingTopic.recordset.length === 1) {
          topicId = existingTopic.recordset[0].id
          topicsSkipped += 1
        } else {
          const ins = await pool
            .request()
            .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
            .input('name', sql.NVarChar(200), name)
            .query('INSERT INTO dbo.ResourceBookTopics (resource_book_id, name) OUTPUT inserted.id VALUES (@rbId, @name);')
          topicId = ins.recordset[0].id
          topicsCreated += 1
          console.log(`İçerik (yeni): ${name}`)
        }

        for (const test of t.tests) {
          const questionCount = test.answers.length

          const existingTest = await pool
            .request()
            .input('topicId', sql.UniqueIdentifier, topicId)
            .input('name', sql.NVarChar(200), test.name)
            .query(`
              SELECT tt.id, tt.page_start,
                (SELECT COUNT(*) FROM dbo.TestAnswerKeys k WHERE k.test_id = tt.id) AS answer_count
              FROM dbo.ResourceBookTopicTests tt
              WHERE tt.topic_id = @topicId AND tt.name = @name;
            `)
          if (existingTest.recordset.length > 1) throw new Error(`Aynı adlı birden fazla test: ${name} / ${test.name}`)

          let testId
          if (existingTest.recordset.length === 1) {
            const row = existingTest.recordset[0]
            testId = row.id
            await pool
              .request()
              .input('id', sql.UniqueIdentifier, testId)
              .input('count', sql.Int, questionCount)
              .input('pageStart', sql.Int, test.page)
              .query('UPDATE dbo.ResourceBookTopicTests SET question_count = @count, page_start = @pageStart WHERE id = @id;')
            if (row.answer_count > 0) {
              testsSkipped += 1
              continue
            }
            console.log(`${name} / ${test.name}: test var, cevap anahtarı ekleniyor.`)
          } else {
            const ins = await pool
              .request()
              .input('topicId', sql.UniqueIdentifier, topicId)
              .input('topicName', sql.NVarChar(200), name)
              .input('name', sql.NVarChar(200), test.name)
              .input('pageStart', sql.Int, test.page)
              .input('questionCount', sql.Int, questionCount)
              .query(`
                INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_start, page_end, page_count, question_count)
                OUTPUT inserted.id
                VALUES (@topicId, @topicName, @name, @pageStart, NULL, 1, @questionCount);
              `)
            testId = ins.recordset[0].id
            testsCreated += 1
            console.log(`${name} / ${test.name}: test oluşturuldu (${questionCount} soru, sayfa ${test.page}).`)
          }

          const req = pool.request().input('testId', sql.UniqueIdentifier, testId)
          const valueRows = []
          test.answers.split('').forEach((label, i) => {
            req.input(`o${i}`, sql.Int, i + 1)
            req.input(`l${i}`, sql.NChar(1), label)
            valueRows.push(`(@testId, @o${i}, @l${i})`)
          })
          await req.query(`INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label) VALUES ${valueRows.join(', ')};`)
          keysInserted += 1
          console.log(`  cevap anahtarı: ${test.answers.split('').map((l, i) => `${i + 1}${l}`).join(' ')}`)
        }
      }
    }

    console.log(
      `\nBitti. Yeni İçerik: +${topicsCreated} (mevcut: ${topicsSkipped}), ` +
        `yeni test: +${testsCreated} (cevap anahtarı zaten olan: ${testsSkipped}), cevap anahtarı yazılan: +${keysInserted}`,
    )

    const summary = await pool
      .request()
      .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query(`
        SELECT tp.name AS topic_name,
          (SELECT COUNT(*) FROM dbo.ResourceBookTopicTests tt WHERE tt.topic_id = tp.id) AS test_count
        FROM dbo.ResourceBookTopics tp
        WHERE tp.resource_book_id = @rbId
        ORDER BY tp.created_at ASC;
      `)
    console.log('\nKaynaktaki İçerikler:')
    summary.recordset.forEach((r, i) => {
      console.log(`  ${String(i + 1).padStart(2)}. ${r.topic_name}  (${r.test_count} test)`)
    })
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
