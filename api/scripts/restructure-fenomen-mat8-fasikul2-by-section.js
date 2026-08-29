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

// Fenomen "2. Fasikül - Üslü İfadeler" (8. Sınıf Matematik, aktif kopya).
// Tek "1. Ünite - Üslü İfadeler" içeriği altındaki 31 testi, kaynağın "İçindekiler"
// sayfasındaki bölümlere göre ayrı İçeriklere (ResourceBookTopic) böler.
// 3. Fasikül'deki yapıyla aynı olması için yapıldı.
const RESOURCE_BOOK_ID = 'A3DA7443-327B-42DC-B689-779DB17431DB'
const OLD_TOPIC_NAME = '1. Ünite - Üslü İfadeler'

// Yeni İçerik adları (İçindekiler bölüm başlıkları), panelde görünecekleri sırada.
const SECTIONS = [
  'Üslü İfadeler (Negatif Üs)',
  'Üslü İfadelerde Çarpma İşlemi',
  'Üslü İfadelerde Çarpma ve Bölme İşlemi',
  'Ondalık Sayılarda Çözümleme',
  '10\'un Tam Sayı Kuvvetlerinin Eşitleri ve Bilimsel Gösterim',
]

// Testlerin mevcut topic_name değeri -> ait olduğu yeni İçerik adı.
const TOPIC_NAME_TO_SECTION = {
  'Üslü İfadeler (Negatif Üs)': 'Üslü İfadeler (Negatif Üs)',
  'Üslü İfadelerde Çarpma İşlemi': 'Üslü İfadelerde Çarpma İşlemi',
  'Üslü İfadelerde Bölme İşlemi': 'Üslü İfadelerde Çarpma ve Bölme İşlemi',
  'Üslü İfadelerde Çarpma ve Bölme İşlemi': 'Üslü İfadelerde Çarpma ve Bölme İşlemi',
  'Ondalık Sayılarda Çözümleme': 'Ondalık Sayılarda Çözümleme',
  '10\'un Tam Sayı Kuvvetlerinin Eşitleri ve Bilimsel Gösterim':
    '10\'un Tam Sayı Kuvvetlerinin Eşitleri ve Bilimsel Gösterim',
  'Ünite-1 Ondalıklı Sayılarda Çözümleme ve Bilimsel Gösterim':
    '10\'un Tam Sayı Kuvvetlerinin Eşitleri ve Bilimsel Gösterim',
}

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const oldTopic = await pool
      .request()
      .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .input('name', sql.NVarChar(200), OLD_TOPIC_NAME)
      .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId AND name = @name;')
    if (!oldTopic.recordset.length) throw new Error(`Eski içerik bulunamadı: ${OLD_TOPIC_NAME}`)
    const oldTopicId = oldTopic.recordset[0].id

    const tests = await pool
      .request()
      .input('topicId', sql.UniqueIdentifier, oldTopicId)
      .query('SELECT id, name, topic_name FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId;')
    console.log(`Eski içerikte ${tests.recordset.length} test var.`)

    // Her testin hedef bölümünü belirle; eşleşmeyen varsa hiç dokunmadan çık.
    const unmatched = tests.recordset.filter((t) => !TOPIC_NAME_TO_SECTION[t.topic_name])
    if (unmatched.length) {
      console.error('Eşleşmeyen testler (işlem yapılmadı):')
      unmatched.forEach((t) => console.error(`  - "${t.topic_name}" / "${t.name}"`))
      throw new Error('Tüm testler bir bölüme eşleşmeli.')
    }

    // Bölüm İçeriklerini sırayla oluştur (veya varsa yeniden kullan).
    const sectionTopicId = {}
    for (const sectionName of SECTIONS) {
      const existing = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
        .input('name', sql.NVarChar(200), sectionName)
        .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId AND name = @name;')
      if (existing.recordset.length) {
        sectionTopicId[sectionName] = existing.recordset[0].id
        console.log(`İçerik (mevcut): ${sectionName}`)
      } else {
        const inserted = await pool
          .request()
          .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
          .input('name', sql.NVarChar(200), sectionName).query(`
            INSERT INTO dbo.ResourceBookTopics (resource_book_id, name)
            OUTPUT inserted.id
            VALUES (@rbId, @name);
          `)
        sectionTopicId[sectionName] = inserted.recordset[0].id
        console.log(`İçerik (yeni): ${sectionName}`)
      }
    }

    // Testleri yeni İçeriklerine taşı; topic_name'i de yeni İçerik adına eşitle.
    let moved = 0
    for (const test of tests.recordset) {
      const sectionName = TOPIC_NAME_TO_SECTION[test.topic_name]
      await pool
        .request()
        .input('id', sql.UniqueIdentifier, test.id)
        .input('newTopicId', sql.UniqueIdentifier, sectionTopicId[sectionName])
        .input('newTopicName', sql.NVarChar(200), sectionName)
        .query('UPDATE dbo.ResourceBookTopicTests SET topic_id = @newTopicId, topic_name = @newTopicName WHERE id = @id;')
      moved += 1
    }
    console.log(`${moved} test yeni İçeriklere taşındı.`)

    // Eski içerik boşsa sil.
    const remaining = await pool
      .request()
      .input('topicId', sql.UniqueIdentifier, oldTopicId)
      .query('SELECT COUNT(*) AS c FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId;')
    if (remaining.recordset[0].c === 0) {
      await pool
        .request()
        .input('id', sql.UniqueIdentifier, oldTopicId)
        .query('DELETE FROM dbo.ResourceBookTopics WHERE id = @id;')
      console.log(`Eski içerik silindi: ${OLD_TOPIC_NAME}`)
    } else {
      console.log(`Eski içerikte hâlâ ${remaining.recordset[0].c} test var, silinmedi.`)
    }

    console.log('Tamamlandı.')
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Restructure failed')
  console.error(error)
  process.exit(1)
})
