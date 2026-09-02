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

// "Paragrafın Şifresi" (7. Sınıf, özel kaynak / scope=private, Paragrafın Şifresi Yayınları).
// Kaynağın "İçindekiler" sayfasındaki 23 metot, birer "İçerik" (ResourceBookTopic) olarak eklenir.
// ResourceBookTopics tablosunda sayfa kolonu yok; sayfa aralıkları yalnızca kayıt/referans için
// yorumda tutulur, testler sonradan elle eklenecek.
const RESOURCE_BOOK_ID = 'F9639A95-BC60-4DF9-96F5-D80FC1161799'

// [numara, İçerik adı, [sayfa başlangıç, sayfa bitiş]] — İçindekiler sırasıyla.
const TOPICS = [
  [1, 'Söz Öbeği Metodu', [5, 11]],
  [2, 'Cümlede Anlam Özelliği Metodu', [12, 20]],
  [3, 'Anlam Bilgisi Metodu', [21, 28]],
  [4, 'Deyim - Atasözü - Özdeyiş Metodu', [29, 35]],
  [5, 'Yardımcı Düşünce Metodu', [36, 46]],
  [6, 'Anahtar Sözcük Metodu', [47, 54]],
  [7, 'Anlatım Özelliği Metodu', [55, 61]],
  [8, 'Ana Düşünce Metodu', [62, 70]],
  [9, 'Bakış Açısı ve İlişkilendirme Metodu', [71, 79]],
  [10, 'Boşluk Tamamlama Metodu', [80, 86]],
  [11, 'Özdeşlik Metodu', [87, 96]],
  [12, 'Bağlantı Ögeleri Metodu', [97, 104]],
  [13, 'Kavram Haritası Metodu', [105, 113]],
  [14, 'Paragraf Oluşturma Metodu', [114, 120]],
  [15, 'Konu Belirleme Metodu', [121, 128]],
  [16, 'Kesinlik Metodu', [129, 135]],
  [17, 'Sanatlı Söyleyiş Metodu', [136, 142]],
  [18, 'Anlatım Biçimi/Düşünceyi Geliştirme Metodu', [143, 152]],
  [19, 'Yanıt Paragrafı Metodu', [153, 162]],
  [20, 'Metin Türleri Metodu', [163, 171]],
  [21, 'Tablo ve Grafik Yorumlama', [172, 189]],
  [22, 'Sözel Mantık Metodu', [190, 198]],
  [23, 'Görsel Okuma Metodu', [199, 217]],
]

// İçindekiler'e geçmeden önce bu kaynakta numarasız oluşturulmuş İçerikler:
// "Söz Öbeği Metodu" (1) ve "Cümlede Anlam Özelliği Metodu" (2). Bunları numaralı
// isimlerine çeviririz; bağlı testlerin topic_name alanını da eşitleriz. Testler taşınmaz.
const LEGACY_RENAMES = new Map([
  ['Söz Öbeği Metodu', '1. Söz Öbeği Metodu'],
  ['Cümlede Anlam Özelliği Metodu', '2. Cümlede Anlam Özelliği Metodu'],
])

function numberedName([no, name]) {
  return `${no}. ${name}`
}

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const book = await pool
      .request()
      .input('id', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT id, name, scope, grade FROM dbo.ResourceBooks WHERE id = @id;')
    if (!book.recordset.length) throw new Error(`ResourceBook not found: ${RESOURCE_BOOK_ID}`)
    console.log(`ResourceBook: ${book.recordset[0].name} (scope=${book.recordset[0].scope}, ${book.recordset[0].grade}. sınıf)`)

    // 1) Numarasız eski İçerikleri yeniden adlandır + testlerin topic_name alanını eşitle.
    let renamed = 0
    for (const [oldName, newName] of LEGACY_RENAMES) {
      const topic = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
        .input('oldName', sql.NVarChar(200), oldName)
        .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId AND name = @oldName;')
      if (!topic.recordset.length) {
        console.log(`(atlandı) yeniden adlandırılacak İçerik yok: ${oldName}`)
        continue
      }
      for (const row of topic.recordset) {
        await pool
          .request()
          .input('id', sql.UniqueIdentifier, row.id)
          .input('newName', sql.NVarChar(200), newName)
          .query('UPDATE dbo.ResourceBookTopics SET name = @newName WHERE id = @id;')
        const upd = await pool
          .request()
          .input('topicId', sql.UniqueIdentifier, row.id)
          .input('newName', sql.NVarChar(200), newName)
          .query('UPDATE dbo.ResourceBookTopicTests SET topic_name = @newName WHERE topic_id = @topicId;')
        console.log(`İçerik adı: "${oldName}" -> "${newName}" (${upd.rowsAffected[0]} testin topic_name alanı güncellendi)`)
        renamed += 1
      }
    }

    // 2) İçindekiler sırasına göre eksik İçerikleri ekle (idempotent: numaralı ad zaten varsa atla).
    let created = 0
    let skipped = 0
    for (const entry of TOPICS) {
      const [, , [pageStart, pageEnd]] = entry
      const name = numberedName(entry)
      const existing = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
        .input('name', sql.NVarChar(200), name)
        .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId AND name = @name;')
      if (existing.recordset.length) {
        console.log(`İçerik (mevcut): ${name}`)
        skipped += 1
        continue
      }
      await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
        .input('name', sql.NVarChar(200), name)
        .query('INSERT INTO dbo.ResourceBookTopics (resource_book_id, name) VALUES (@rbId, @name);')
      created += 1
      console.log(`İçerik (yeni): ${name}  [kaynak sayfa ${pageStart}-${pageEnd}]`)
    }

    console.log(`\nBitti. Yeniden adlandırılan: ${renamed}, yeni İçerik: +${created}, zaten var: ${skipped}`)

    const all = await pool
      .request()
      .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT name FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId ORDER BY created_at ASC;')
    console.log(`\nKaynaktaki İçerikler (created_at sırası):`)
    all.recordset.forEach((r, i) => console.log(`  ${String(i + 1).padStart(2)}. ${r.name}`))
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
