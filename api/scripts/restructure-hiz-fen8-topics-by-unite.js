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

const PUBLISHER_NAME = 'Hız Yayınları'
const BOOK_NAME = '8. Sınıf Fen Bilimleri Soru Bankası'

// Which existing fine-grained topic names belong to which Ünite (in book order).
const UNITE_GROUPS = [
  {
    unite: '1. Ünite',
    topics: ['Mevsimlerin Oluşumu', 'İklim ve Hava Hareketleri', '1. Ünite Değerlendirme Testi'],
  },
  {
    unite: '2. Ünite',
    topics: [
      'DNA ve Genetik Kod',
      'Kalıtım',
      'Mutasyon, Modifikasyon ve Adaptasyon',
      'Biyoteknoloji',
      '2. Ünite Değerlendirme Testi',
    ],
  },
  {
    unite: '3. Ünite',
    topics: ['Katı Basıncı', 'Sıvı Basıncı', 'Gaz Basıncı', '3. Ünite Değerlendirme Testi'],
  },
  {
    unite: '4. Ünite',
    topics: [
      'Periyodik Sistem',
      'Fiziksel ve Kimyasal Değişimler',
      'Kimyasal Tepkimeler',
      'Asitler ve Bazlar',
      '4. Ünite Değerlendirme Testi (1)',
      'Isı ve Sıcaklık',
      'Sıcaklık Değişimi',
      'Hâl Değişimi',
      'Hâl Değişim Isıları',
      'Hâl Değişim Grafikleri',
      '4. Ünite Değerlendirme Testi (2)',
      'Kimya Endüstrisi',
    ],
  },
  {
    unite: '5. Ünite',
    topics: [
      'Sabit Makara',
      'Hareketli Makara',
      'Palanga',
      'Kaldıraç',
      'Eğik Düzlem',
      'Çıkrık',
      'Dişli Çark ve Kasnak',
      'Vida',
      '5. Ünite Değerlendirme Testi',
    ],
  },
  {
    unite: '6. Ünite',
    topics: [
      'Besin Zinciri ve Enerji Akışı',
      'Fotosentez',
      'Solunum',
      'Fotosentez - Solunum',
      'Madde Döngüleri ve Çevre Sorunları',
      'Sürdürülebilir Kalkınma',
      '6. Ünite Değerlendirme Testi',
    ],
  },
  {
    unite: '7. Ünite',
    topics: [
      'Elektrik Yükleri ve Elektriklenme',
      'Elektrik Yüklü Cisimler',
      'Elektrik Enerjisinin Dönüşümü',
      '7. Ünite Değerlendirme Testi',
    ],
  },
]

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(connectionString)

  try {
    const bookResult = await pool
      .request()
      .input('publisherName', sql.NVarChar(150), PUBLISHER_NAME)
      .input('bookName', sql.NVarChar(200), BOOK_NAME).query(`
        SELECT rb.id
        FROM dbo.ResourceBooks rb
        INNER JOIN dbo.Publishers p ON p.id = rb.publisher_id
        WHERE p.name = @publisherName AND rb.name = @bookName;
      `)

    if (!bookResult.recordset.length) {
      throw new Error('ResourceBook not found')
    }
    const resourceBookId = bookResult.recordset[0].id

    const existingTopicsResult = await pool
      .request()
      .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
      .query('SELECT id, name FROM dbo.ResourceBookTopics WHERE resource_book_id = @resourceBookId;')

    const existingTopicIdByName = new Map(existingTopicsResult.recordset.map((t) => [t.name, t.id]))

    const expectedNames = UNITE_GROUPS.flatMap((g) => g.topics)
    if (expectedNames.length !== existingTopicsResult.recordset.length) {
      throw new Error(
        `Topic count mismatch: expected ${expectedNames.length}, found ${existingTopicsResult.recordset.length}`,
      )
    }
    for (const name of expectedNames) {
      if (!existingTopicIdByName.has(name)) {
        throw new Error(`Existing topic not found for name: ${name}`)
      }
    }

    const oldTopicIdsToDelete = []

    for (const group of UNITE_GROUPS) {
      const uniteTopicResult = await pool
        .request()
        .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
        .input('name', sql.NVarChar(200), group.unite).query(`
          INSERT INTO dbo.ResourceBookTopics (resource_book_id, name)
          OUTPUT inserted.id
          VALUES (@resourceBookId, @name);
        `)
      const uniteTopicId = uniteTopicResult.recordset[0].id

      let movedTests = 0
      for (const oldName of group.topics) {
        const oldTopicId = existingTopicIdByName.get(oldName)
        const updateResult = await pool
          .request()
          .input('newTopicId', sql.UniqueIdentifier, uniteTopicId)
          .input('oldTopicId', sql.UniqueIdentifier, oldTopicId).query(`
            UPDATE dbo.ResourceBookTopicTests
            SET topic_id = @newTopicId
            WHERE topic_id = @oldTopicId;
          `)
        movedTests += updateResult.rowsAffected[0]
        oldTopicIdsToDelete.push(oldTopicId)
      }

      console.log(`${group.unite}: ${group.topics.length} eski konu, ${movedTests} test taşındı -> ${uniteTopicId}`)
    }

    for (const oldTopicId of oldTopicIdsToDelete) {
      await pool
        .request()
        .input('id', sql.UniqueIdentifier, oldTopicId)
        .query('DELETE FROM dbo.ResourceBookTopics WHERE id = @id;')
    }

    console.log(`Silinen eski konu sayısı: ${oldTopicIdsToDelete.length}`)
    console.log('Restructure tamamlandı.')
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Restructure failed')
  console.error(error)
  process.exit(1)
})
