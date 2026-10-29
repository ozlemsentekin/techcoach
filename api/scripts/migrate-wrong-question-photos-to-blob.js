// Hata Defteri fotoğraflarını (WrongQuestions.photo_url + WrongQuestionAnalysisPhotos.photo_url)
// veritabanındaki base64 data URL'den Azure Blob'a taşır; kolona "azblob:" referansı yazılır
// (bkz. api/src/blobStore.js). Tekrar çalıştırılabilir: yalnızca hâlâ 'data:' ile başlayan satırlar
// işlenir. Satır, okunduğu andaki değerle aynıysa güncellenir (HASHBYTES karşılaştırması) —
// arada kullanıcı fotoğrafı değiştirdiyse yüklenen dosya silinir, satıra dokunulmaz.
//
// Kullanım:
//   node api/scripts/migrate-wrong-question-photos-to-blob.js            # kuru çalışma: sayılar
//   node api/scripts/migrate-wrong-question-photos-to-blob.js --apply    # taşı (--limit=N ile ilk N satır)
//   node api/scripts/migrate-wrong-question-photos-to-blob.js --cleanup-orphans [--apply]
//       # hiçbir satırın referans vermediği (değiştirilmiş/silinmiş fotoğraf) ve 1 saatten eski dosyaları sil
const crypto = require('crypto')
const sql = require('mssql')
const { getSqlConfig } = require('../src/config')
const {
  BLOB_REF_PREFIX,
  WRONG_QUESTION_PHOTOS_CONTAINER,
  isBlobConfigured,
  storeDataUrl,
  deleteBlobRef,
} = require('../src/blobStore')
const { BlobServiceClient } = require('@azure/storage-blob')

const APPLY = process.argv.includes('--apply')
const CLEANUP = process.argv.includes('--cleanup-orphans')
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith('--limit='))
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : Infinity
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000

const SOURCES = [
  {
    label: 'WrongQuestions',
    listSql: `SELECT id, student_id FROM dbo.WrongQuestions WHERE photo_url IS NOT NULL AND SUBSTRING(photo_url, 1, 5) = 'data:' ORDER BY created_at;`,
    readSql: `SELECT photo_url FROM dbo.WrongQuestions WHERE id = @id;`,
    updateSql: `UPDATE dbo.WrongQuestions SET photo_url = @ref
                WHERE id = @id AND HASHBYTES('SHA2_256', photo_url) = @hash;`,
  },
  {
    label: 'WrongQuestionAnalysisPhotos',
    listSql: `SELECT p.id, wq.student_id FROM dbo.WrongQuestionAnalysisPhotos p
              JOIN dbo.WrongQuestions wq ON wq.id = p.wrong_question_id
              WHERE p.photo_url IS NOT NULL AND SUBSTRING(p.photo_url, 1, 5) = 'data:' ORDER BY p.created_at;`,
    readSql: `SELECT photo_url FROM dbo.WrongQuestionAnalysisPhotos WHERE id = @id;`,
    updateSql: `UPDATE dbo.WrongQuestionAnalysisPhotos SET photo_url = @ref
                WHERE id = @id AND HASHBYTES('SHA2_256', photo_url) = @hash;`,
  },
]

// NVARCHAR, SQL Server'da UTF-16LE saklanır; HASHBYTES bu baytlar üzerinden hesaplanır.
function sqlNvarcharHash(value) {
  return crypto.createHash('sha256').update(Buffer.from(value, 'utf16le')).digest()
}

async function migrate(pool) {
  for (const source of SOURCES) {
    const rows = (await pool.request().query(source.listSql)).recordset.slice(0, LIMIT)
    console.log(`${source.label}: ${rows.length} satır taşınacak`)
    if (!APPLY) continue

    let moved = 0
    let skipped = 0
    let failed = 0
    let bytes = 0
    for (const row of rows) {
      try {
        const current = (await pool.request().input('id', sql.UniqueIdentifier, row.id).query(source.readSql)).recordset[0]
        const photoUrl = current?.photo_url
        if (!photoUrl || !photoUrl.startsWith('data:')) {
          skipped += 1
          continue
        }
        const ref = await storeDataUrl(photoUrl, { prefix: row.student_id })
        if (!ref.startsWith(BLOB_REF_PREFIX)) throw new Error('Depoya yüklenemedi (data URL biçimi?).')

        const result = await pool.request()
          .input('id', sql.UniqueIdentifier, row.id)
          .input('ref', sql.NVarChar(sql.MAX), ref)
          .input('hash', sql.VarBinary(32), sqlNvarcharHash(photoUrl))
          .query(source.updateSql)
        if (result.rowsAffected[0] === 1) {
          moved += 1
          bytes += photoUrl.length
        } else {
          await deleteBlobRef(ref)
          skipped += 1
        }
      } catch (error) {
        failed += 1
        console.error(`  ${source.label} ${row.id}: ${error.message}`)
      }
      const done = moved + skipped + failed
      if (done % 25 === 0) console.log(`  ${done}/${rows.length} (taşınan ${moved}, ~${Math.round(bytes / 1048576)} MB base64)`)
    }
    console.log(`${source.label}: taşınan ${moved}, atlanan ${skipped}, hata ${failed}`)
  }
}

async function cleanupOrphans(pool) {
  const refs = new Set()
  for (const table of ['WrongQuestions', 'WrongQuestionAnalysisPhotos']) {
    const result = await pool.request().query(
      `SELECT photo_url FROM dbo.${table} WHERE photo_url IS NOT NULL AND SUBSTRING(photo_url, 1, ${BLOB_REF_PREFIX.length}) = '${BLOB_REF_PREFIX}';`,
    )
    result.recordset.forEach((row) => refs.add(row.photo_url))
  }

  const container = BlobServiceClient.fromConnectionString(process.env.BLOB_CONNECTION_STRING)
    .getContainerClient(WRONG_QUESTION_PHOTOS_CONTAINER)
  let total = 0
  const orphans = []
  for await (const blob of container.listBlobsFlat()) {
    total += 1
    const ref = `${BLOB_REF_PREFIX}${WRONG_QUESTION_PHOTOS_CONTAINER}/${blob.name}`
    const age = Date.now() - new Date(blob.properties.createdOn).getTime()
    if (!refs.has(ref) && age > ORPHAN_MIN_AGE_MS) orphans.push(ref)
  }
  console.log(`Depoda ${total} dosya, DB'de ${refs.size} referans, başıboş ${orphans.length}`)
  if (!APPLY) return
  for (const ref of orphans) await deleteBlobRef(ref)
  console.log(`${orphans.length} başıboş dosya silindi (7 gün geri alınabilir).`)
}

async function main() {
  if (!isBlobConfigured()) throw new Error('BLOB_CONNECTION_STRING tanımlı değil.')
  // S0'da büyük LOB satırlarını okumak varsayılan 15 sn'yi aşabiliyor.
  const pool = new sql.ConnectionPool(getSqlConfig().sqlConnectionString)
  pool.config.requestTimeout = 10 * 60 * 1000
  await pool.connect()
  try {
    if (CLEANUP) {
      await cleanupOrphans(pool)
    } else {
      await migrate(pool)
    }
    if (!APPLY) console.log('Kuru çalışma — değişiklik yapmak için --apply ekleyin.')
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
