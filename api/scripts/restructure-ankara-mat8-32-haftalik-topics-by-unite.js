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

const PUBLISHER_NAME = 'Ankara Yayıncılık'
const BOOK_NAME = 'Güçlendiren 32 Haftalık Kazanım Denemeleri Matematik'

// Same master Ünite grouping/naming used for the Güçlendiren Soru Bankası book
// (see restructure-ankara-mat8-topics-by-unite.js), so both resources share one
// consistent content-group structure. Each existing "NN. Hafta - ..." topic is
// folded into the matching Ünite based on the MEB curriculum order.
const UNITE_GROUPS = [
  {
    unite: '1. Ünite - Çarpanlar, Katlar ve Üslü İfadeler',
    topics: [
      '01. Hafta - Pozitif Tam Sayıların Pozitif Tam Sayı Çarpanları',
      '02. Hafta - En Büyük Ortak Bölen (EBOB), En Küçük Ortak Kat (EKOK)',
      '03. Hafta - Aralarında Asal Sayılar',
      '04. Hafta - Tam Sayıların Tam Sayı Kuvvetleri, Üslü İfadelerle İlgili Temel Kurallar',
      '05. Hafta - Üslü İfadelerle İlgili Temel Kurallar, Ondalık Gösterimlerin Bilimsel Gösterimi',
      "06. Hafta - 10'un Kuvvetleri - Bilimsel Gösterim",
    ],
  },
  {
    unite: '2. Ünite - Kareköklü İfadeler ve Veri Analizi',
    topics: [
      '07. Hafta - Tam Kare Sayılar, Tam Kare Olmayan Sayıların Değer Aralıkları',
      '08. Hafta - a√b Şeklindeki İfadeler',
      '09. Hafta - Kareköklü İfadeler ile Çarpma ve Bölme İşlemleri',
      '10. Hafta - Kareköklü İfadeler ile Toplama ve Çıkarma İşlemleri',
      '11. Hafta - Ondalık Gösterimlerin Karekökü - Gerçek Sayılar',
      '12. Hafta - Çizgi, Sütun ve Daire Grafiklerini Yorumlama, Grafikler Arası Dönüşümler - I',
      '13. Hafta - Çizgi, Sütun ve Daire Grafiklerini Yorumlama, Grafikler Arası Dönüşümler - II',
    ],
  },
  {
    unite: '3. Ünite - Olasılık, Cebirsel İfadeler ve Özdeşlikler',
    topics: [
      '14. Hafta - Olasılık Kavramları',
      '15. Hafta - Olasılık Değeri',
      '16. Hafta - Cebirsel İfadelerle Çarpma İşlemi',
      '17. Hafta - Özdeşlikler',
      '18. Hafta - Cebirsel İfadeleri Çarpanlara Ayırma',
    ],
  },
  {
    unite: '4. Ünite - Doğrusal Denklemler ve Eşitsizlikler',
    topics: [
      '19. Hafta - Birinci Dereceden Bir Bilinmeyenli Denklemler',
      '20. Hafta - Koordinat Sistemi',
      '21. Hafta - Doğru Grafikleri',
      '22. Hafta - Doğrusal İlişki',
      '23. Hafta - Eğim',
      '24. Hafta - Eşitsizlik Yazma ve Sayı Doğrusunda Gösterme',
      '25. Hafta - Eşitsizlik Çözme',
    ],
  },
  {
    unite: '5. Ünite - Üçgenler, Eşlik ve Benzerlik',
    topics: [
      '26. Hafta - Üçgende Yardımcı Doğrular - Üçgen Eşitsizliği',
      '27. Hafta - Üçgende Açı-Kenar Bağıntıları - Üçgen Çizimi',
      '28. Hafta - Pisagor Bağıntısı',
      '29. Hafta - Eşlik ve Benzerlik',
    ],
  },
  {
    unite: '6. Ünite - Dönüşüm Geometrisi ve Geometrik Cisimler',
    topics: [
      '30. Hafta - Öteleme - Yansıma - Ötelemeli Yansıma',
      '31. Hafta - Prizmaların ve Silindirlerin Temel Özellikleri',
      '32. Hafta - Silindirin Alanı ve Hacmi',
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
        SELECT rb.id FROM dbo.ResourceBooks rb
        INNER JOIN dbo.Publishers p ON p.id = rb.publisher_id
        WHERE p.name = @publisherName AND rb.name = @bookName;
      `)
    if (!bookResult.recordset.length) throw new Error('ResourceBook not found')
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
