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

const PUBLISHER_NAME = 'Günay Yayınları'
const BOOK_NAME = 'Bumerang Serisi'
const UNITE_NAME = '5. Ünite - Basit Makineler'

// İçindekiler sayfasındaki gerçek test sayfaları. DB'de ilk 6 testin page_start
// değeri konu başlığı sayfalarına kaymıştı (Makaralar 297, Eğik Düzlem 311 vb.);
// sıralama doğruydu ama sayfa numaraları yanlıştı.
const PAGES = [
  ['Kavratan Test-1', 291],
  ['Bumerang Test-1', 295],
  ['Kavratan Test-2', 305],
  ['Bumerang Test-2', 309],
  ['Kavratan Test-3', 315],
  ['Bumerang Test-3', 319],
  ['Kavratan Test-4', 325],
  ['Bumerang Test-4', 329],
  ['Beceri Temelli Test-1', 331],
  ['Beceri Temelli Test-2', 335],
]

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const book = await pool.request()
      .input('p', sql.NVarChar(150), PUBLISHER_NAME)
      .input('b', sql.NVarChar(200), BOOK_NAME).query(`
        SELECT rb.id FROM dbo.ResourceBooks rb
        JOIN dbo.Publishers p ON p.id = rb.publisher_id
        WHERE p.name = @p AND rb.name = @b;`)
    if (!book.recordset.length) throw new Error('ResourceBook not found')
    const bookId = book.recordset[0].id

    const tests = await pool.request()
      .input('b', sql.UniqueIdentifier, bookId)
      .input('u', sql.NVarChar(200), UNITE_NAME).query(`
        SELECT tt.id, tt.name, tt.page_start
        FROM dbo.ResourceBookTopicTests tt
        JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
        WHERE t.resource_book_id = @b AND t.name = @u;`)
    const byName = new Map(tests.recordset.map((r) => [r.name, r]))
    if (byName.size !== PAGES.length) throw new Error(`Expected ${PAGES.length} tests, found ${byName.size}`)

    for (const [name, page] of PAGES) {
      const row = byName.get(name)
      if (!row) throw new Error(`Test not found: ${name}`)
      if (row.page_start === page) {
        console.log(`= ${name}: zaten ${page}`)
        continue
      }
      await pool.request()
        .input('id', sql.UniqueIdentifier, row.id)
        .input('page', sql.Int, page)
        .query('UPDATE dbo.ResourceBookTopicTests SET page_start = @page WHERE id = @id;')
      console.log(`~ ${name}: ${row.page_start} -> ${page}`)
    }
    console.log('\n5. Ünite sayfa numaraları düzeltildi.')
  } finally {
    await pool.close()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
