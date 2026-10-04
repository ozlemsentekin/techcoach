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

// "Güçlendiren Paragraf Soru Bankası - Türkçe - 8. Sınıf"
//
// Soru metni YOK — sadece İÇERİK (Bölüm/alt başlık) + TEST ADI + SAYFA + cevap anahtarı eklenir.
// Kitap 4 ana Bölüm'den oluşuyor; 1. Bölüm tek bir başlık altında (alt bölümsüz) 22 test
// içeriyor, 2-4. Bölümler ise her biri birden fazla "(Testler)" adlı alt başlığa ayrılıyor
// (konu anlatımı sayfaları hariç, sadece test grupları İçerik olarak eklendi).
//
// page      : İÇİNDEKİLER'deki her "(Testler)" başlığının sayfası; testler arası sayfa
//              TOC'de tek tek verilmediği için başlıktan bir sonraki başlığa kadar olan
//              aralık, test sayısına bölünerek orantılı dağıtıldı (1. Bölüm'de TOC hiç
//              test bazlı sayfa vermediği için tüm bölüm aralığı -11-138- eşit dağıtıldı).
// answers   : el yazısı/basılı cevap anahtarı fotoğraflarından transkribe edildi; soru
//              sayısı testten teste değişiyor (question_count = dizinin uzunluğu).
//
// İdempotent: var olan İçerik/test/cevap anahtarını atlar; eksik cevap anahtarını tamamlar.
const RESOURCE_BOOK_ID = '1591144A-3032-410C-9B5E-178F03BCB66D'

function distributePages(startPage, endPageExclusive, count) {
  const span = endPageExclusive - startPage
  const step = span / count
  const pages = []
  for (let i = 0; i < count; i++) {
    pages.push(startPage + Math.round(i * step))
  }
  return pages
}

const BOLUMLER = [
  {
    name: '1. Bölüm: Görsel Okuma, Grafik Yorumu, İnfografik Yorumu, Yaratıcı ve Analitik Düşünme, Sözel, Mantıksal Muhakeme ve Akıl Yürütme',
    pageRange: [11, 139],
    answers: [
      'ABCCBD',
      'CBBCABABBD',
      'CCBCACBBCD',
      'CCBACDDCCBA',
      'BCBDACACD',
      'BBACABCAB',
      'CDDCBCBACB',
      'BDCDCBDDBC',
      'BDBBABAACDBC',
      'BCDBDDADCADA',
      'BADACCDCBAC',
      'CDCCDAAADABC',
      'CADCCBABCDCB',
      'CADBBCABC',
      'CBDDBD',
      'DDBBDADBD',
      'BBDDABDDB',
      'ACCBDBBBCD',
      'DBBCDADB',
      'BCDBCCAC',
      'AABCCCCDB',
      'CDCCACBBBA',
    ],
  },
  {
    name: '2. Bölüm: Sözcükte Anlam - Sözcüğün Anlam Özellikleri',
    pageRange: [151, 157],
    answers: ['BBBADCCCACDB', 'BCCDBCACCBCD', 'BBCADACCBCDC'],
  },
  {
    name: '2. Bölüm: Sözcükte Anlam - Sözcükte Anlam İlişkileri',
    pageRange: [157, 163],
    answers: ['ABCDDDABBBA', 'DBBDCCCD', 'ACBCCCBCCCBB'],
  },
  {
    name: '2. Bölüm: Sözcükte Anlam - Söz Gruplarında Anlam',
    pageRange: [163, 167],
    answers: ['BACCABBDDBDB', 'BCDABDCBADBA'],
  },
  {
    name: '2. Bölüm: Sözcükte Anlam - Bölüm Değerlendirme',
    pageRange: [167, 185],
    answers: [
      'ABCAABCCCCDD',
      'DDDBAACACACD',
      'DDDCABBCBCD',
      'BACCBDDBCCBC',
      'CDCBADBCACBC',
      'BDBBCBACBAC',
      'DDCBBBDA',
    ],
  },
  {
    name: '3. Bölüm: Cümlede Anlam - Cümlede Anlam İlişkileri',
    pageRange: [195, 203],
    answers: ['BACBACACDDAC', 'DDBCDBABDDCB', 'CBBCDCDADBDA', 'BABAADCCACDB'],
  },
  {
    name: '3. Bölüm: Cümlede Anlam - Anlatımına Göre Cümleler',
    pageRange: [203, 211],
    answers: ['AADBAADCCCCB', 'AABDCDCDADCD', 'ADDAADCDBAAC', 'DDBDDCDADACD'],
  },
  {
    name: '3. Bölüm: Cümlede Anlam - Çeşitli Duygu ve Düşünce Bildiren Cümleler',
    pageRange: [211, 217],
    answers: ['CDDDDCABCABA', 'CDCBDCCABCCD', 'CADBCDCDBDCB'],
  },
  {
    name: '3. Bölüm: Cümlede Anlam - Cümle Tamamlama - Cümle Oluşturma - Konu',
    pageRange: [217, 223],
    answers: ['ACBDBBDBBCAC', 'DAABBBCBCBBA', 'DACDBBDCACAC'],
  },
  {
    name: '3. Bölüm: Cümlede Anlam - Bölüm Değerlendirme',
    pageRange: [223, 239],
    answers: [
      'CBACCDBBCBDA',
      'CDCAADBBBCBC',
      'DDCCBDDBBABD',
      'DBDADDBBCDDC',
      'ADDBCBDBBDBC',
      'BCBABBBCDDDCB',
    ],
  },
  {
    name: '4. Bölüm: Parçada Anlam - Paragrafın Anlam Yönü',
    pageRange: [243, 263],
    answers: [
      'BDBADABBBCD',
      'CABBBACDAB',
      'DCDADCDCCBD',
      'DCBDDAAC',
      'CBCCABDAD',
      'CCCDCACAADA',
      'BACCDCACDCC',
      'CBAADBCAAA',
      'CCACDDBCCB',
      'BDCDDAACBA',
    ],
  },
  {
    name: '4. Bölüm: Parçada Anlam - Paragrafın Yapı Yönü',
    pageRange: [271, 287],
    answers: [
      'CCDACBACCCBD',
      'BBABDBCBCC',
      'BCBBBBBDDCCD',
      'BBCDCCBCABC',
      'ABBBCDCCDBC',
      'BCBBCACCCBC',
      'CCDCCCCCBCCA',
      'DDACCDBABBCD',
    ],
  },
  {
    name: '4. Bölüm: Parçada Anlam - Paragrafın Dil ve Anlatım Yönü',
    pageRange: [293, 315],
    answers: [
      'BBADDBDACAC',
      'BBBDBDCBBCAD',
      'CCABBDDADDA',
      'ACBCDDACBAD',
      'CCADAABDBBD',
      'CBAADCADABA',
      'CDBCBBCCCBC',
      'CADDBADDBD',
      'CCBBACDBDDDA',
      'CDADDBCACAD',
      'CDCCCCBACBC',
    ],
  },
  {
    name: '4. Bölüm: Parçada Anlam - Bölüm Değerlendirme',
    pageRange: [315, 327],
    answers: [
      'CCBCCDBCC',
      'AADCCBBCD',
      'CABBADBDBC',
      'ADADCABBB',
      'BCABBCCBDDA',
      'BCCDBDDACABB',
    ],
  },
]

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  for (const bolum of BOLUMLER) {
    bolum.tests = bolum.answers.map((answers, i) => {
      if (!/^[A-D]+$/.test(answers)) throw new Error(`${bolum.name} / Test ${i + 1}: geçersiz cevap dizisi "${answers}"`)
      return { no: i + 1, answers }
    })
    const pages = distributePages(bolum.pageRange[0], bolum.pageRange[1], bolum.tests.length)
    bolum.tests.forEach((t, i) => {
      t.page = pages[i]
      const next = pages[i + 1]
      t.pageEnd = next ? next - 1 : bolum.pageRange[1] - 1
      if (t.pageEnd < t.page) t.pageEnd = t.page
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

    for (const bolum of BOLUMLER) {
      let topicId
      const existingTopic = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
        .input('name', sql.NVarChar(300), bolum.name)
        .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId AND name = @name;')
      if (existingTopic.recordset.length > 1) throw new Error(`Aynı adlı birden fazla İçerik: ${bolum.name}`)
      if (existingTopic.recordset.length === 1) {
        topicId = existingTopic.recordset[0].id
        topicsSkipped += 1
        console.log(`İçerik (var): ${bolum.name}`)
      } else {
        const ins = await pool
          .request()
          .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
          .input('name', sql.NVarChar(300), bolum.name)
          .query('INSERT INTO dbo.ResourceBookTopics (resource_book_id, name) OUTPUT inserted.id VALUES (@rbId, @name);')
        topicId = ins.recordset[0].id
        topicsCreated += 1
        console.log(`İçerik (yeni): ${bolum.name}`)
      }

      for (const t of bolum.tests) {
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
        if (existingTest.recordset.length > 1) throw new Error(`Aynı adlı birden fazla test: ${bolum.name} / ${testName}`)

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
            .input('topicName', sql.NVarChar(300), bolum.name)
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
