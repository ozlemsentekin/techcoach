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

// "Biltest Türkçe Soru Bankası 8. Sınıf" (Bilfen Yayınları, scope = 'catalog' / Kütüphane).
// Soru metni YOK — diğer soru bankası kaynaklarındaki gibi sadece İÇERİK + TEST KONUSU/ADI +
// SAYFA NUMARASI eklenir.
//
// FAZ 1 (bu script): İçerik + test adı + sayfa numarası. question_count ve cevap anahtarı YOK.
//   Cevap anahtarı, kitabın "Yanıt Anahtarı" sayfalarının (271-272) net fotoğrafları geldiğinde
//   ayrı bir "fill-biltest-turkce8-answers.js" ile test adı bazında eklenecek.
//
// İçerik (ResourceBookTopics): İÇİNDEKİLER'deki alt başlıklar, "N. Konu · Alt Başlık" biçiminde
//   (jenerik "Genel Değerlendirme Testi" / "Yazım Kuralları" vb. adlar Konu numarasıyla ayrışır).
// Test adları kitaptaki global numaralandırmayla ("Test 1" .. "Test 73").
// page: her testin sayfa başlığından okunan basılı sayfa numarası (İÇİNDEKİLER ile çapraz kontrol).
//   page_end, bir sonraki testin sayfasından (nextPage - 1) türetilir; son test için page + 3.
//
// İdempotent: her İçerik adı ve her test adı için ayrı ayrı — zaten varsa atlanır.
const RESOURCE_BOOK_ID = '20F36DF8-25F8-4977-8724-A1A41D8AA8B0'

const ICERIKLER = [
  // ── KONU 1: FİİLİMSİLER ─────────────────────────────────────────────────
  {
    name: '1. Konu · Fiilimsiler',
    tests: [
      { no: 1, page: 8 },
      { no: 2, page: 10 },
      { no: 3, page: 12 },
      { no: 4, page: 14 },
      { no: 5, page: 16 },
    ],
  },

  // ── KONU 2: SÖZCÜKTE ANLAM ─────────────────────────────────────────────
  {
    name: '2. Konu · Sözcüğün Cümlede Kazandığı Anlamlar',
    tests: [
      { no: 6, page: 22 },
      { no: 7, page: 26 },
    ],
  },
  { name: '2. Konu · Sözcükler Arası Anlam İlişkileri', tests: [{ no: 8, page: 30 }] },
  { name: '2. Konu · Söz Sanatları', tests: [{ no: 9, page: 34 }] },
  { name: '2. Konu · Deyimler', tests: [{ no: 10, page: 38 }] },
  { name: '2. Konu · Deyimlerde ve Söz Öbeklerinde Anlam', tests: [{ no: 11, page: 42 }] },
  {
    name: '2. Konu · Sözcükte Anlam',
    tests: [
      { no: 12, page: 46 },
      { no: 13, page: 50 },
      { no: 14, page: 54 },
    ],
  },

  // ── KONU 3: CÜMLENİN ÖGELERİ ───────────────────────────────────────────
  { name: '3. Konu · Cümlenin Temel Ögeleri', tests: [{ no: 15, page: 60 }] },
  { name: '3. Konu · Cümlenin Yardımcı Ögeleri', tests: [{ no: 16, page: 62 }] },
  { name: '3. Konu · Cümle Vurgusu / Ara Söz', tests: [{ no: 17, page: 64 }] },
  {
    name: '3. Konu · Cümlenin Ögeleri',
    tests: [
      { no: 18, page: 66 },
      { no: 19, page: 68 },
    ],
  },

  // ── KONU 4: CÜMLEDE ANLAM ──────────────────────────────────────────────
  { name: '4. Konu · Cümlenin Anlamı ve Yorumu, Cümle Yapısı', tests: [{ no: 20, page: 72 }] },
  { name: '4. Konu · Öznel - Nesnel Anlatımlı Cümleler', tests: [{ no: 21, page: 76 }] },
  {
    name: '4. Konu · Cümlede Anlam İlişkileri (Neden, Amaç, Koşul Cümleleri)',
    tests: [{ no: 22, page: 80 }],
  },
  { name: '4. Konu · Atasözleri', tests: [{ no: 23, page: 84 }] },
  {
    name: '4. Konu · Cümlenin İfade Ettiği Anlamlar, Duygu İfade Eden Cümleler',
    tests: [{ no: 24, page: 88 }],
  },
  {
    name: '4. Konu · Cümlede Anlam',
    tests: [
      { no: 25, page: 92 },
      { no: 26, page: 96 },
      { no: 27, page: 100 },
    ],
  },

  // ── KONU 5: FİİLDE ÇATI ────────────────────────────────────────────────
  { name: '5. Konu · Öznesine Göre Fiil Çatıları', tests: [{ no: 28, page: 106 }] },
  { name: '5. Konu · Nesnesine Göre Fiil Çatıları', tests: [{ no: 29, page: 108 }] },
  {
    name: '5. Konu · Fiilde Çatı',
    tests: [
      { no: 30, page: 110 },
      { no: 31, page: 112 },
      { no: 32, page: 114 },
    ],
  },

  // ── KONU 6: PARAGRAFTA ANLAM ───────────────────────────────────────────
  { name: '6. Konu · Paragrafın Konusu', tests: [{ no: 33, page: 118 }] },
  { name: '6. Konu · Paragrafın Ana Düşüncesi', tests: [{ no: 34, page: 122 }] },
  { name: '6. Konu · Paragrafın Yardımcı Düşünceleri', tests: [{ no: 35, page: 126 }] },
  { name: '6. Konu · Paragrafın Yapısı', tests: [{ no: 36, page: 130 }] },
  {
    name: '6. Konu · Hikâye Unsurları ve Edebî Metinlerde Anlatıcı',
    tests: [{ no: 37, page: 134 }],
  },
  { name: '6. Konu · Paragrafta Anlatım Biçimleri', tests: [{ no: 38, page: 138 }] },
  { name: '6. Konu · Paragrafta Düşünceyi Geliştirme Yolları', tests: [{ no: 39, page: 142 }] },
  {
    name: '6. Konu · Görsel, Grafik ve Tablo Yorumlama, Sözel Mantık',
    tests: [
      { no: 40, page: 146 },
      { no: 41, page: 150 },
      { no: 42, page: 154 },
      { no: 43, page: 158 },
    ],
  },
  {
    name: '6. Konu · Paragrafta Anlam',
    tests: [
      { no: 44, page: 162 },
      { no: 45, page: 166 },
      { no: 46, page: 170 },
      { no: 47, page: 174 },
    ],
  },
  {
    name: '6. Konu · Genel Değerlendirme Testi',
    tests: [
      { no: 48, page: 180 },
      { no: 49, page: 186 },
    ],
  },

  // ── KONU 7: CÜMLE TÜRLERİ ──────────────────────────────────────────────
  { name: '7. Konu · Yüklemin Türüne ve Yerine Göre Cümleler', tests: [{ no: 50, page: 194 }] },
  { name: '7. Konu · Anlamına ve Yapısına Göre Cümleler', tests: [{ no: 51, page: 196 }] },
  { name: '7. Konu · Yapısına Göre Cümleler', tests: [{ no: 52, page: 198 }] },
  {
    name: '7. Konu · Cümle Türleri',
    tests: [
      { no: 53, page: 200 },
      { no: 54, page: 202 },
    ],
  },

  // ── KONU 8: YAZIM KURALLARI ────────────────────────────────────────────
  { name: '8. Konu · Büyük Harflerin Kullanıldığı Yerler', tests: [{ no: 55, page: 206 }] },
  { name: "8. Konu · de / -de, ki / -ki ve mi'nin Yazımı", tests: [{ no: 56, page: 208 }] },
  {
    name: '8. Konu · Sayıların, Pekiştirmeli Sözlerin, İkilemelerin Yazımı ve Diğer Yazım Konuları',
    tests: [{ no: 57, page: 210 }],
  },
  {
    name: '8. Konu · Yazım Kuralları',
    tests: [
      { no: 58, page: 212 },
      { no: 59, page: 214 },
    ],
  },

  // ── KONU 9: NOKTALAMA İŞARETLERİ ───────────────────────────────────────
  { name: '9. Konu · Nokta, Virgül, Noktalı Virgül, İki Nokta', tests: [{ no: 60, page: 218 }] },
  {
    name: '9. Konu · Üç Nokta, Soru İşareti, Ünlem İşareti, Kısa Çizgi',
    tests: [{ no: 61, page: 220 }],
  },
  {
    name: '9. Konu · Uzun Çizgi, Eğik Çizgi, Tırnak İşareti, Yay Ayraç, Kesme İşareti',
    tests: [{ no: 62, page: 222 }],
  },
  {
    name: '9. Konu · Noktalama İşaretleri',
    tests: [
      { no: 63, page: 224 },
      { no: 64, page: 226 },
    ],
  },

  // ── KONU 10: YAPIYA DAYALI ANLATIM BOZUKLUKLARI ────────────────────────
  {
    name: '10. Konu · Yapıya Dayalı Anlatım Bozuklukları',
    tests: [
      { no: 65, page: 230 },
      { no: 66, page: 234 },
      { no: 67, page: 238 },
      { no: 68, page: 242 },
    ],
  },

  // ── KONU 11: EDEBÎ TÜRLER ─────────────────────────────────────────────
  {
    name: '11. Konu · Edebî Türler',
    tests: [
      { no: 69, page: 246 },
      { no: 70, page: 250 },
      { no: 71, page: 254 },
    ],
  },
  {
    name: '11. Konu · Genel Değerlendirme Testi',
    tests: [
      { no: 72, page: 258 },
      { no: 73, page: 264 },
    ],
  },
]

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  // Ön doğrulama: test numaraları 1..73 tekil ve tam
  const seen = new Set()
  const flat = []
  for (const ic of ICERIKLER) {
    for (const t of ic.tests) {
      if (seen.has(t.no)) throw new Error(`Mükerrer test no: ${t.no}`)
      seen.add(t.no)
      flat.push(t)
    }
  }
  for (let n = 1; n <= 73; n += 1) if (!seen.has(n)) throw new Error(`Eksik test no: ${n}`)

  // page_end: sonraki testin sayfası - 1 (sıralı), son test için +3
  flat.sort((a, b) => a.no - b.no)
  flat.forEach((t, i) => {
    const next = flat[i + 1]
    t.pageEnd = next ? Math.max(t.page, next.page - 1) : t.page + 3
  })

  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const book = await pool
      .request()
      .input('id', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT id, name, scope, grade, resource_type FROM dbo.ResourceBooks WHERE id = @id;')
    if (!book.recordset.length) throw new Error(`ResourceBook not found: ${RESOURCE_BOOK_ID}`)
    const b = book.recordset[0]
    console.log(`Kaynak: ${b.name} (scope=${b.scope}, ${b.grade}. sınıf, ${b.resource_type}) -> ${b.id}\n`)

    let topicsCreated = 0
    let topicsSkipped = 0
    let testsCreated = 0
    let testsSkipped = 0

    for (const ic of ICERIKLER) {
      let topicId
      const existing = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
        .input('name', sql.NVarChar(200), ic.name)
        .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId AND name = @name;')
      if (existing.recordset.length) {
        topicId = existing.recordset[0].id
        console.log(`İçerik (var): ${ic.name}`)
        topicsSkipped += 1
      } else {
        const ins = await pool
          .request()
          .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
          .input('name', sql.NVarChar(200), ic.name)
          .query('INSERT INTO dbo.ResourceBookTopics (resource_book_id, name) OUTPUT inserted.id VALUES (@rbId, @name);')
        topicId = ins.recordset[0].id
        topicsCreated += 1
        console.log(`İçerik (yeni): ${ic.name}`)
      }

      for (const t of ic.tests) {
        const testName = `Test ${t.no}`
        const dup = await pool
          .request()
          .input('topicId', sql.UniqueIdentifier, topicId)
          .input('name', sql.NVarChar(200), testName)
          .query('SELECT id FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId AND name = @name;')
        if (dup.recordset.length) {
          console.log(`  ${testName} (var, atlandı)`)
          testsSkipped += 1
          continue
        }

        const rec = flat.find((x) => x.no === t.no)
        await pool
          .request()
          .input('topicId', sql.UniqueIdentifier, topicId)
          .input('topicName', sql.NVarChar(200), ic.name)
          .input('name', sql.NVarChar(200), testName)
          .input('pageStart', sql.Int, rec.page)
          .input('pageEnd', sql.Int, rec.pageEnd)
          .input('pageCount', sql.Int, rec.pageEnd - rec.page + 1)
          .query(`
            INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_start, page_end, page_count, question_count)
            VALUES (@topicId, @topicName, @name, @pageStart, @pageEnd, @pageCount, NULL);
          `)
        testsCreated += 1
        console.log(`  ${testName}: s. ${rec.page}-${rec.pageEnd}`)
      }
    }

    console.log(
      `\nBitti. İçerik: +${topicsCreated} (var: ${topicsSkipped}), test: +${testsCreated} (var: ${testsSkipped}). ` +
        `Cevap anahtarı FAZ 2'de eklenecek.`,
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
