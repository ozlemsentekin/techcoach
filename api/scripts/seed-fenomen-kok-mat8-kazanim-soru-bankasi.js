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

// Fenomen Yayınları — "Fenomen Kök - Kalıcı Öğretici Kazanım Soru Bankası - Matematik 8. Sınıf"
// (scope = 'catalog' / Kütüphane; kaynak panelde önceden oluşturuldu, bu script sadece
// İÇERİK + TEST + CEVAP ANAHTARI ekler).
//
// Yapı, kaynağın kendi "İçindekiler"i + "Cevap Anahtarı" fotoğraflarından:
//   - İçerik (ResourceBookTopic) = cevap anahtarındaki ünite başlığı (Ünite 1 iki bölüme ayrılıyor:
//     "Çarpanlar ve Katlar" ve "Üslü İfadeler"; her bölümün test numarası 1'den başlıyor).
//   - Test adı = "Test <no> · <alt konu>" (alt konu = İçindekiler'deki koyu kırmızı/mavi başlık).
//   - page = testin kitaptaki başlangıç sayfası (İçindekiler'den). Her test 2 sayfa
//     (page_end = page + 1); panelde sıralama içindir.
//   - answers = cevap anahtarı fotoğrafından birebir okundu; soru sayısı = dizi uzunluğu.
//
// İdempotent: aynı isimde bir İçerik zaten varsa o İçerik atlanır.

const PUBLISHER_NAME = 'Fenomen Yayınları'
const BOOK_NAME_LIKE = '%Kalıcı Öğretici Kazanım%Matematik 8%'

const ICERIKLER = [
  {
    name: '1. Ünite · Çarpanlar ve Katlar',
    tests: [
      { no: 1, topic: 'Pozitif Tam Sayıların Pozitif Tam Sayı Çarpanları', page: 5, answers: 'BCCDCCABCCBCDB' },
      { no: 2, topic: 'Pozitif Tam Sayıların Pozitif Tam Sayı Çarpanları', page: 7, answers: 'CCDBDBDCCCDCD' },
      { no: 3, topic: 'Pozitif Tam Sayıların Pozitif Tam Sayı Çarpanları', page: 9, answers: 'CDBCDBDBCBBA' },
      { no: 4, topic: 'Asal Sayılar', page: 11, answers: 'BDCCDABCDCDC' },
      { no: 5, topic: 'Asal Sayılar', page: 13, answers: 'BDDCDCCBDCCCB' },
      { no: 6, topic: 'Asal Çarpanlara Ayırma', page: 15, answers: 'CBDCABCDCBDCAABC' },
      { no: 7, topic: 'Asal Çarpanlara Ayırma', page: 17, answers: 'CDBDCCCCDBDC' },
      { no: 8, topic: 'Asal Çarpanlara Ayırma', page: 19, answers: 'CCDADBBADBD' },
      { no: 9, topic: 'En Büyük Ortak Bölen (EBOB)', page: 21, answers: 'DDCCBDCBCCCB' },
      { no: 10, topic: 'En Büyük Ortak Bölen (EBOB)', page: 23, answers: 'CCDBCCDBCCDD' },
      { no: 11, topic: 'En Küçük Ortak Kat (EKOK)', page: 25, answers: 'BBDBCCBACBCC' },
      { no: 12, topic: 'En Küçük Ortak Kat (EKOK)', page: 27, answers: 'DCBADDDBDBCBD' },
      { no: 13, topic: 'EBOB - EKOK Problemleri', page: 29, answers: 'CDBDBCCCCDD' },
      { no: 14, topic: 'EBOB - EKOK Problemleri', page: 31, answers: 'BCBDBBCDCDB' },
      { no: 15, topic: 'EBOB - EKOK Problemleri', page: 33, answers: 'CBDCDBACBD' },
      { no: 16, topic: 'EBOB - EKOK Problemleri', page: 35, answers: 'BCDCBBDC' },
      { no: 17, topic: 'EBOB - EKOK Problemleri', page: 37, answers: 'DDCDBCDC' },
      { no: 18, topic: 'Aralarında Asal Sayılar', page: 39, answers: 'DDBCADCDDCDBC' },
      { no: 19, topic: 'Aralarında Asal Sayılar', page: 41, answers: 'CBBCDCBCCBBC' },
      { no: 20, topic: 'Aralarında Asal Sayılar', page: 43, answers: 'DCBCDDCCA' },
    ],
  },
  {
    name: '1. Ünite · Üslü İfadeler',
    tests: [
      { no: 1, topic: 'Tam Sayıların Tam Sayı Kuvvetleri', page: 45, answers: 'CCDACADBCBDBB' },
      { no: 2, topic: 'Tam Sayıların Tam Sayı Kuvvetleri', page: 47, answers: 'BADDDADDABCACBA' },
      { no: 3, topic: 'Tam Sayıların Tam Sayı Kuvvetleri', page: 49, answers: 'DDCCCDBBDBABDA' },
      { no: 4, topic: 'Tam Sayıların Tam Sayı Kuvvetleri', page: 51, answers: 'BDCACBDCBCDB' },
      { no: 5, topic: 'Tam Sayıların Tam Sayı Kuvvetleri', page: 53, answers: 'ACBDABCAACCCB' },
      { no: 6, topic: 'Tam Sayıların Tam Sayı Kuvvetleri', page: 55, answers: 'DABBBABABCCADD' },
      { no: 7, topic: 'Üslü İfadelerde Çarpma İşlemi', page: 57, answers: 'CCACBDAACDDDDA' },
      { no: 8, topic: 'Üslü İfadelerde Çarpma İşlemi', page: 59, answers: 'BCAABCCDACBCAC' },
      { no: 9, topic: 'Üslü İfadelerde Çarpma İşlemi', page: 61, answers: 'BCABABDDBCBC' },
      { no: 10, topic: 'Üslü İfadelerde Bölme İşlemi', page: 63, answers: 'BBCADBBCBACCCD' },
      { no: 11, topic: 'Üslü İfadelerde Bölme İşlemi', page: 65, answers: 'BDDDADBABCADD' },
      { no: 12, topic: 'Üslü İfadelerde Bölme İşlemi', page: 67, answers: 'BCCBBADBDACB' },
      { no: 13, topic: 'Üslü İfadelerde Bölme İşlemi', page: 69, answers: 'CCADCCDDACA' },
      { no: 14, topic: 'Ondalık Gösterimleri Çözümleme', page: 71, answers: 'CBACCDBDBCDCD' },
      { no: 15, topic: 'Ondalık Gösterimleri Çözümleme', page: 73, answers: 'DCACDDABDAC' },
      { no: 16, topic: 'Çok Büyük ve Çok Küçük Sayılar', page: 75, answers: 'BCDAACBCCBBCDBA' },
      { no: 17, topic: 'Çok Büyük ve Çok Küçük Sayılar', page: 77, answers: 'CCDCDCDADCCCB' },
      { no: 18, topic: 'Bilimsel Gösterim', page: 79, answers: 'CBCACDCDBCCCD' },
      { no: 19, topic: 'Bilimsel Gösterim', page: 81, answers: 'BCDDBCADCDD' },
    ],
  },
  {
    name: '2. Ünite · Kareköklü İfadeler ve Veri Analizi',
    tests: [
      { no: 1, topic: 'Tam Kare Doğal Sayılar', page: 83, answers: 'BDAABADACCDC' },
      { no: 2, topic: 'Tam Kare Doğal Sayılar', page: 85, answers: 'BBCDACCBDDCC' },
      { no: 3, topic: 'Tam Kare Doğal Sayıların Karekökleri', page: 87, answers: 'DBCADBDDCBADC' },
      { no: 4, topic: 'Tam Kare Doğal Sayıların Karekökleri', page: 89, answers: 'DADBCBDCCDABC' },
      { no: 5, topic: 'Kareköklü İfadelerde Yaklaşık Değer Bulma', page: 91, answers: 'ADBCDDBBCBCBB' },
      { no: 6, topic: 'Kareköklü İfadelerde Yaklaşık Değer Bulma', page: 93, answers: 'DBACBADBDBD' },
      { no: 7, topic: 'Kareköklü İfadelerde Yaklaşık Değer Bulma', page: 95, answers: 'CBACACACAB' },
      { no: 8, topic: 'Kareköklü İfadelerin Farklı Gösterimi', page: 97, answers: 'DCDBBADCCBDCBCD' },
      { no: 9, topic: 'Kareköklü İfadelerin Farklı Gösterimi', page: 99, answers: 'ACCBCDADABCBC' },
      { no: 10, topic: 'Kareköklü İfadelerle Çarpma İşlemi', page: 101, answers: 'CBDABCDCACADD' },
      { no: 11, topic: 'Kareköklü İfadelerle Çarpma İşlemi', page: 103, answers: 'CCADCBBABCAD' },
      { no: 12, topic: 'Kareköklü İfadelerle Çarpma İşlemi', page: 105, answers: 'CDDABBBCBDB' },
      { no: 13, topic: 'Kareköklü İfadelerle Bölme İşlemi', page: 107, answers: 'BCDCADACADABC' },
      { no: 14, topic: 'Kareköklü İfadelerle Bölme İşlemi', page: 109, answers: 'DBACCDACBDCA' },
      { no: 15, topic: 'Kareköklü İfadelerle Bölme İşlemi', page: 111, answers: 'DABCBCCACCB' },
      { no: 16, topic: 'Kareköklü İfadelerle Toplama ve Çıkarma İşlemi', page: 113, answers: 'DBCADBACADDB' },
      { no: 17, topic: 'Kareköklü İfadelerle Toplama ve Çıkarma İşlemi', page: 115, answers: 'ABBDCBCCAB' },
      { no: 18, topic: 'Kareköklü İfadelerle Toplama ve Çıkarma İşlemi', page: 117, answers: 'ABCDDBCDABCB' },
      { no: 19, topic: 'Kareköklü İfadelerle Toplama ve Çıkarma İşlemi', page: 119, answers: 'CDABCDACCCB' },
      { no: 20, topic: 'Kareköklü Bir İfadeyi Tam Sayı Haline Getirme', page: 121, answers: 'DCDDDBDCCABADC' },
      { no: 21, topic: 'Ondalık Gösterimlerin Karekökleri', page: 123, answers: 'CDAADBCDCADBDAB' },
      { no: 22, topic: 'Gerçek Sayılar', page: 125, answers: 'CDCCABBCDBAC' },
      { no: 23, topic: 'Veri Analizi', page: 127, answers: 'CBDDCBDA' },
      { no: 24, topic: 'Veri Analizi', page: 129, answers: 'CDBADBCB' },
      { no: 25, topic: 'Veri Analizi', page: 131, answers: 'CBDCCABC' },
      { no: 26, topic: 'Veri Analizi', page: 133, answers: 'CDCBDCCA' },
    ],
  },
  {
    name: '3. Ünite · Olasılık / Cebirsel İfadeler ve Özdeşlikler',
    tests: [
      { no: 1, topic: 'Olasılık', page: 135, answers: 'CAADACDCDBDB' },
      { no: 2, topic: 'Olasılık', page: 137, answers: 'CCADADCCDBC' },
      { no: 3, topic: 'Olasılık', page: 139, answers: 'DDBCCADBCDC' },
      { no: 4, topic: 'Olasılık', page: 141, answers: 'BDABDABCACDBD' },
      { no: 5, topic: 'Olasılık', page: 143, answers: 'BCDADBABCBDA' },
      { no: 6, topic: 'Olasılık', page: 145, answers: 'BBDCDDBABDD' },
      { no: 7, topic: 'Olasılık', page: 147, answers: 'DABACCABACBD' },
      { no: 8, topic: 'Basit Cebirsel İfadeler', page: 149, answers: 'DCACABCDABBDC' },
      { no: 9, topic: 'Cebirsel İfadelerde Çarpma İşlemi', page: 151, answers: 'DCDBDBCCCDACCCA' },
      { no: 10, topic: 'Cebirsel İfadelerde Çarpma İşlemi', page: 153, answers: 'CDCBDBCDCADACBC' },
      { no: 11, topic: 'Cebirsel İfadelerde Çarpma İşlemi ve Modelleme', page: 155, answers: 'CBDCADCACDC' },
      { no: 12, topic: 'Cebirsel İfadeler ve Özdeşlikler', page: 157, answers: 'CDCADDCCDDDCCC' },
      { no: 13, topic: 'Cebirsel İfadeler ve Özdeşlikler', page: 159, answers: 'DDBADABCBCBC' },
      { no: 14, topic: 'Cebirsel İfadeler ve Özdeşlikler', page: 161, answers: 'DDABBDCBADDACB' },
      { no: 15, topic: 'Cebirsel İfadeleri Çarpanlara Ayırma', page: 163, answers: 'BCBAACACDDBCBD' },
      { no: 16, topic: 'Cebirsel İfadeleri Çarpanlara Ayırma', page: 165, answers: 'ACDCCBCCADABC' },
      { no: 17, topic: 'Cebirsel İfadeleri Çarpanlara Ayırma', page: 167, answers: 'DBCCACBCCDB' },
    ],
  },
  {
    name: '4. Ünite · Doğrusal Denklemler ve Eşitsizlikler',
    tests: [
      { no: 1, topic: 'Birinci Dereceden Bir Bilinmeyenli Denklemler', page: 169, answers: 'ADDCDADACACDABDCA' },
      { no: 2, topic: 'Birinci Dereceden Bir Bilinmeyenli Denklemler', page: 171, answers: 'CBDBBACACCABDCB' },
      { no: 3, topic: 'Birinci Dereceden Bir Bilinmeyenli Denklemler', page: 173, answers: 'BCBDCDDAAADB' },
      { no: 4, topic: 'Birinci Dereceden Bir Bilinmeyenli Denklemler', page: 175, answers: 'CDCCACBCADDC' },
      { no: 5, topic: 'Birinci Dereceden Bir Bilinmeyenli Denklemler', page: 177, answers: 'CBACDBCBADCC' },
      { no: 6, topic: 'Birinci Dereceden Bir Bilinmeyenli Denklemler', page: 179, answers: 'AABDACCAAC' },
      { no: 7, topic: 'Birinci Dereceden Bir Bilinmeyenli Denklemler', page: 181, answers: 'CABAACBACBAA' },
      { no: 8, topic: 'Birinci Dereceden Bir Bilinmeyenli Denklemler', page: 183, answers: 'DCADBACC' },
      { no: 9, topic: 'Koordinat Sistemi', page: 185, answers: 'DBCDBCBABAA' },
      { no: 10, topic: 'Koordinat Sistemi', page: 187, answers: 'DADDADBCBCDACB' },
      { no: 11, topic: 'Koordinat Sistemi', page: 189, answers: 'ACBADBADBC' },
      { no: 12, topic: 'Doğrusal İlişki Grafikleri', page: 191, answers: 'CBCABCACDB' },
      { no: 13, topic: 'Doğrusal İlişki Grafikleri', page: 193, answers: 'BACBCDDDBCA' },
      { no: 14, topic: 'Doğrusal Denklemlerin Grafikleri', page: 195, answers: 'CBDAABDBDCC' },
      { no: 15, topic: 'Doğrusal Denklemlerin Grafikleri', page: 197, answers: 'CBCCACCDACADC' },
      { no: 16, topic: 'Eğim', page: 199, answers: 'BADACCDBABD' },
      { no: 17, topic: 'Eğim', page: 201, answers: 'CBCCACAABACC' },
      { no: 18, topic: 'Doğrunun Eğimi', page: 203, answers: 'CDACBAADDACBAB' },
      { no: 19, topic: 'Eşitsizlikler', page: 205, answers: 'DCCDDADBACDA' },
      { no: 20, topic: 'Eşitsizlikler', page: 207, answers: 'ACDCAADABCD' },
      { no: 21, topic: 'Eşitsizliklerin Çözümü', page: 209, answers: 'ACCDADBDACBBCBD' },
      { no: 22, topic: 'Eşitsizliklerin Çözümü', page: 211, answers: 'ADCABBCCDBBC' },
      { no: 23, topic: 'Eşitsizliklerin Çözümü', page: 213, answers: 'DDACBCBABD' },
      { no: 24, topic: 'Eşitsizliklerin Çözümü', page: 215, answers: 'DBBCCADDA' },
    ],
  },
  {
    name: '5. Ünite · Üçgenler / Pisagor / Eşlik ve Benzerlik',
    tests: [
      { no: 1, topic: 'Üçgenin Yardımcı Elemanları', page: 217, answers: 'CBADBCBCDBAD' },
      { no: 2, topic: 'Üçgenin Yardımcı Elemanları', page: 219, answers: 'BDABCBDCADAB' },
      { no: 3, topic: 'Üçgende Açı-Kenar Bağıntıları', page: 221, answers: 'ACBCBDDCBACB' },
      { no: 4, topic: 'Üçgende Açı-Kenar Bağıntıları', page: 223, answers: 'ABCDBCACDBCD' },
      { no: 5, topic: 'Üçgende Açı-Kenar Bağıntıları', page: 225, answers: 'BCACBCBABDAD' },
      { no: 6, topic: 'Üçgende Açı-Kenar Bağıntıları', page: 227, answers: 'BACACBBDBACAB' },
      { no: 7, topic: 'Üçgen Çizimi', page: 229, answers: 'CADCBACBDCAD' },
      { no: 8, topic: 'Pisagor Bağıntısı', page: 231, answers: 'BCDABCBADCAB' },
      { no: 9, topic: 'Pisagor Bağıntısı', page: 233, answers: 'CABBDCACBCDA' },
      { no: 10, topic: 'Pisagor Bağıntısı', page: 235, answers: 'BDCACCBCDCBD' },
      { no: 11, topic: 'Pisagor Bağıntısı', page: 237, answers: 'BACBDDABDBBD' },
      { no: 12, topic: 'Pisagor Bağıntısı', page: 239, answers: 'BCABCDDABCDC' },
      { no: 13, topic: 'Çokgenlerin Eşliği', page: 241, answers: 'CDDCBCCDBADC' },
      { no: 14, topic: 'Çokgenlerin Eşliği', page: 243, answers: 'BDBCBABDACDC' },
      { no: 15, topic: 'Çokgenlerin Benzerliği', page: 245, answers: 'BABBADDCBACC' },
      { no: 16, topic: 'Çokgenlerin Benzerliği', page: 247, answers: 'DCDBABCABCDB' },
      { no: 17, topic: 'Çokgenlerin Benzerliği', page: 249, answers: 'BCAACBACBDBD' },
    ],
  },
  {
    name: '6. Ünite · Dönüşüm Geometrisi / Geometrik Cisimler',
    tests: [
      { no: 1, topic: 'Öteleme', page: 251, answers: 'CABDCCDCBD' },
      { no: 2, topic: 'Yansıma', page: 253, answers: 'BBCCDBCAAC' },
      { no: 3, topic: 'Yansıma ve Öteleme', page: 255, answers: 'BCACBCBBC' },
      { no: 4, topic: 'Dik Prizmalar', page: 257, answers: 'DCCDBCBDCABCC' },
      { no: 5, topic: 'Dik Prizmalar', page: 259, answers: 'CBDBDCBBC' },
      { no: 6, topic: 'Silindir', page: 261, answers: 'ACDBCBBDCCB' },
      { no: 7, topic: 'Silindir', page: 263, answers: 'BCCBADCCBAB' },
      { no: 8, topic: 'Silindir', page: 265, answers: 'ABBCDCCDCCCAD' },
      { no: 9, topic: 'Dik Piramitler', page: 267, answers: 'BCCDBBBCDC' },
      { no: 10, topic: 'Koni', page: 269, answers: 'CCBBBACBCBD' },
    ],
  },
]

function testDisplayName(t) {
  return `Test ${t.no} · ${t.topic}`
}

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING eksik.')

  // Ön doğrulama
  for (const ic of ICERIKLER) {
    for (const t of ic.tests) {
      if (!/^[A-D]+$/.test(t.answers)) {
        throw new Error(`Geçersiz cevap dizisi: ${ic.name} / ${testDisplayName(t)} — ${t.answers}`)
      }
    }
  }

  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const book = await pool
      .request()
      .input('pub', sql.NVarChar(150), PUBLISHER_NAME)
      .input('like', sql.NVarChar(200), BOOK_NAME_LIKE)
      .query(`
        SELECT b.id, b.name, b.scope, b.grade, b.resource_type
        FROM dbo.ResourceBooks b
        JOIN dbo.Publishers p ON p.id = b.publisher_id
        WHERE p.name = @pub AND b.name LIKE @like;
      `)
    if (!book.recordset.length) {
      throw new Error(`Kaynak bulunamadı: "${PUBLISHER_NAME}" / LIKE "${BOOK_NAME_LIKE}". Önce panelden oluşturulmalı.`)
    }
    if (book.recordset.length > 1) {
      throw new Error(
        `Birden fazla kaynak eşleşti, netleştir:\n${book.recordset.map((r) => `  - ${r.name} (${r.id})`).join('\n')}`,
      )
    }
    const b = book.recordset[0]
    const resourceBookId = b.id
    console.log(`Kaynak: ${b.name} (scope=${b.scope}, ${b.grade}. sınıf, ${b.resource_type}) -> ${resourceBookId}\n`)

    let topicsCreated = 0
    let topicsSkipped = 0
    let testsCreated = 0
    let answerRows = 0

    for (const ic of ICERIKLER) {
      const existing = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, resourceBookId)
        .input('name', sql.NVarChar(200), ic.name)
        .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId AND name = @name;')
      if (existing.recordset.length) {
        console.log(`İçerik (var, atlandı): ${ic.name}`)
        topicsSkipped += 1
        continue
      }

      const ins = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, resourceBookId)
        .input('name', sql.NVarChar(200), ic.name)
        .query('INSERT INTO dbo.ResourceBookTopics (resource_book_id, name) OUTPUT inserted.id VALUES (@rbId, @name);')
      const topicId = ins.recordset[0].id
      topicsCreated += 1
      console.log(`İçerik (yeni): ${ic.name}`)

      for (const t of ic.tests) {
        const questionCount = t.answers.length
        const pageStart = t.page
        const pageEnd = pageStart + 1
        const testName = testDisplayName(t)

        const insTest = await pool
          .request()
          .input('topicId', sql.UniqueIdentifier, topicId)
          .input('topicName', sql.NVarChar(200), ic.name)
          .input('name', sql.NVarChar(200), testName)
          .input('pageStart', sql.Int, pageStart)
          .input('pageEnd', sql.Int, pageEnd)
          .input('pageCount', sql.Int, pageEnd - pageStart + 1)
          .input('questionCount', sql.Int, questionCount)
          .query(`
            INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_start, page_end, page_count, question_count)
            OUTPUT inserted.id
            VALUES (@topicId, @topicName, @name, @pageStart, @pageEnd, @pageCount, @questionCount);
          `)
        const testId = insTest.recordset[0].id
        testsCreated += 1

        const req = pool.request().input('testId', sql.UniqueIdentifier, testId)
        const valueRows = []
        t.answers.split('').forEach((label, idx) => {
          req.input(`o${idx}`, sql.Int, idx + 1)
          req.input(`l${idx}`, sql.NChar(1), label)
          valueRows.push(`(@testId, @o${idx}, @l${idx})`)
        })
        await req.query(`INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label) VALUES ${valueRows.join(', ')};`)
        answerRows += questionCount
        console.log(`  ${testName}: ${questionCount} soru (sayfa ${pageStart}) — ${t.answers}`)
      }
    }

    console.log(
      `\nBitti. İçerik: +${topicsCreated} (atlanan ${topicsSkipped}), test: +${testsCreated}, cevap anahtarı satırı: +${answerRows}`,
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
