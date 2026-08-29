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

// Fenomen "3. Fasikül - Kareköklü İfadeler ve Veri Analizi" — kaynağın "İçindekiler"
// sayfasına göre içerik adı / test adı / sayfa numarası düzeltmeleri.
const RESOURCE_BOOK_ID = '332E8C73-E296-439D-B58E-25D742913C92'

// [eski içerik adı, yeni içerik adı] — İçindekiler'deki başlıklara hizalama.
const TOPIC_RENAMES = [
  ['Kareköklü Sayılarla Çarpma ve Bölme İşlemi', 'Kareköklü Sayılarda Çarpma ve Bölme İşlemleri'],
  ['Kareköklü İfadelerde Toplama ve Çıkarma İşlemi', 'Kareköklü Sayılarda Toplama ve Çıkarma İşlemleri'],
]

// [içerik adı (yeni), eski test adı, yeni test adı]
const TEST_RENAMES = [
  [
    'Ondalık Gösterimlerin Karekökleri ve Gerçek Sayılar',
    "Ondalık Gösterimlerin Karekökleri ve Gerçek Sayılar İle İlgili LGS'de Çıkmış Sorular",
    "Kareköklü İfadeler İle İlgili LGS'de Çıkmış Sorular",
  ],
]

// içerik adı (yeni) -> { test adı: [page_start, page_end] }
// Son testlerin bitiş sayfası, İçindekiler'de bir sonraki bölümün başladığı sayfaya göre tahmin edildi.
const PAGES = {
  'Tamkare Pozitif Tam Sayılar': {
    'Test 1': [3, 4],
    'Test 2': [5, 6],
    'Test 3': [7, 8],
  },
  'Tamkare Sayıların Karekökleri': {
    'Test 1': [11, 12],
    'Test 2': [13, 14],
  },
  'Kareköklü Bir İfadenin Farklı Gösterimi': {
    'Test 1': [23, 24],
    'Test 2': [25, 26],
    'Test 3': [27, 28],
    'Test 4': [29, 32],
    "Tamkare ve Yaklaşık Değer İle İlgili LGS'de Çıkmış Sorular": [33, 36],
  },
  'Kareköklü Sayılarda Çarpma ve Bölme İşlemleri': {
    'Test 1': [45, 46],
    'Test 2': [47, 48],
    'Test 3': [49, 50],
    'Test 4': [51, 53],
  },
  'Kareköklü Sayılarda Toplama ve Çıkarma İşlemleri': {
    'Test 1': [60, 61],
    'Test 2': [62, 63],
    'Test 3': [64, 65],
    'Test 4': [66, 69],
    'Test 5': [70, 73],
    'Test 6': [74, 76],
    'Test 7': [77, 79],
    'Test 8': [80, 83],
    'Test 9': [84, 87],
    "Kareköklü İfadelerde Dört İşlem İle İlgili LGS'de Çıkmış Sorular": [88, 91],
  },
  'Ondalık Gösterimlerin Karekökleri ve Gerçek Sayılar': {
    'Test 1': [96, 97],
    'Test 2': [98, 99],
    'Test 3': [100, 103],
    "Kareköklü İfadeler İle İlgili LGS'de Çıkmış Sorular": [104, 104],
  },
  'Veri Analizi': {
    'Test 1': [111, 112],
    'Test 2': [113, 114],
    'Test 3': [115, 116],
    'Test 4': [117, 119],
    "Veri Analizi İle İlgili LGS'de Çıkmış Sorular": [120, 125],
  },
}

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    // 1) İçerik (topic) adlarını güncelle + o içeriğe bağlı tüm testlerin topic_name alanını da eşitle.
    for (const [oldName, newName] of TOPIC_RENAMES) {
      const topic = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
        .input('oldName', sql.NVarChar(200), oldName)
        .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId AND name = @oldName;')
      if (!topic.recordset.length) {
        console.log(`(atlandı) İçerik bulunamadı: ${oldName}`)
        continue
      }
      const topicId = topic.recordset[0].id
      await pool
        .request()
        .input('id', sql.UniqueIdentifier, topicId)
        .input('newName', sql.NVarChar(200), newName)
        .query('UPDATE dbo.ResourceBookTopics SET name = @newName WHERE id = @id;')
      const upd = await pool
        .request()
        .input('topicId', sql.UniqueIdentifier, topicId)
        .input('newName', sql.NVarChar(200), newName)
        .query('UPDATE dbo.ResourceBookTopicTests SET topic_name = @newName WHERE topic_id = @topicId;')
      console.log(`İçerik adı: "${oldName}" -> "${newName}" (${upd.rowsAffected[0]} testin topic_name alanı güncellendi)`)
    }

    // 2) Test adı düzeltmeleri.
    for (const [topicName, oldTestName, newTestName] of TEST_RENAMES) {
      const res = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
        .input('topicName', sql.NVarChar(200), topicName)
        .input('oldTestName', sql.NVarChar(200), oldTestName)
        .input('newTestName', sql.NVarChar(200), newTestName).query(`
          UPDATE tt SET tt.name = @newTestName
          FROM dbo.ResourceBookTopicTests tt
          INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
          WHERE t.resource_book_id = @rbId AND t.name = @topicName AND tt.name = @oldTestName;
        `)
      console.log(`Test adı: "${oldTestName}" -> "${newTestName}" (${res.rowsAffected[0]} satır)`)
    }

    // 3) Sayfa numaraları.
    let pageUpdates = 0
    const notFound = []
    for (const [topicName, tests] of Object.entries(PAGES)) {
      for (const [testName, [start, end]] of Object.entries(tests)) {
        const res = await pool
          .request()
          .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
          .input('topicName', sql.NVarChar(200), topicName)
          .input('testName', sql.NVarChar(200), testName)
          .input('start', sql.Int, start)
          .input('end', sql.Int, end)
          .input('count', sql.Int, end - start + 1).query(`
            UPDATE tt SET tt.page_start = @start, tt.page_end = @end, tt.page_count = @count
            FROM dbo.ResourceBookTopicTests tt
            INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
            WHERE t.resource_book_id = @rbId AND t.name = @topicName AND tt.name = @testName;
          `)
        if (res.rowsAffected[0] === 0) notFound.push(`${topicName} / ${testName}`)
        else pageUpdates += res.rowsAffected[0]
      }
    }
    console.log(`\nSayfa numarası güncellenen test: ${pageUpdates}`)
    if (notFound.length) {
      console.log(`Eşleşmeyen (atlanan): ${notFound.length}`)
      notFound.forEach((k) => console.log(`  - ${k}`))
    }
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Update failed')
  console.error(error)
  process.exit(1)
})
