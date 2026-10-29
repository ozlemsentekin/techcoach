// Veritabanı kolonlarında base64 data URL olarak duran dosyaları Azure Blob'a taşır; kolona
// "azblob:" referansı yazılır (bkz. api/src/blobStore.js). Tekrar çalıştırılabilir: yalnızca hâlâ
// data URL içeren satırlar işlenir. Satır, okunduğu andaki değerle aynıysa güncellenir (HASHBYTES)
// — arada değiştiyse yüklenen dosyalar silinir, satıra dokunulmaz. Aynı içerik (ör. kardeş okullara
// kopyalanmış kaynak görseli) depoya bir kez yüklenir.
//
// Kullanım:
//   node api/scripts/migrate-files-to-blob.js                      # kuru çalışma: sayılar
//   node api/scripts/migrate-files-to-blob.js --apply [--limit=N] [--only=Tablo]
//   node api/scripts/migrate-files-to-blob.js --cleanup-orphans [--apply]
//       # hiçbir satırın referans vermediği (değiştirilmiş/silinmiş) ve 1 saatten eski dosyaları sil
const crypto = require('crypto')
const sql = require('mssql')
const { BlobServiceClient } = require('@azure/storage-blob')
const { getSqlConfig } = require('../src/config')
const { BLOB_REF_PREFIX, CONTAINERS, isBlobConfigured, isBlobRef, storeDataUrl, deleteBlobRef } = require('../src/blobStore')

const APPLY = process.argv.includes('--apply')
const CLEANUP = process.argv.includes('--cleanup-orphans')
const argValue = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]
const LIMIT = argValue('limit') ? Number(argValue('limit')) : Infinity
const ONLY = argValue('only')
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000

// kind: 'scalar' (kolonun kendisi data URL), 'strings' (JSON string dizisi), 'objects' (JSON [{ url }]).
// prefixColumn: depodaki klasör (öğrenci / talep id'si) — üye silmede toplu temizlik için.
const SOURCES = [
  { table: 'WrongQuestions', column: 'photo_url', kind: 'scalar', container: CONTAINERS.wrongQuestionPhotos, from: 'dbo.WrongQuestions t', prefixColumn: 't.student_id' },
  { table: 'WrongQuestionAnalysisPhotos', column: 'photo_url', kind: 'scalar', container: CONTAINERS.wrongQuestionPhotos, from: 'dbo.WrongQuestionAnalysisPhotos t JOIN dbo.WrongQuestions wq ON wq.id = t.wrong_question_id', prefixColumn: 'wq.student_id' },
  { table: 'PanelRequestPhotos', column: 'photo_url', kind: 'scalar', container: CONTAINERS.panelRequestPhotos, from: 'dbo.PanelRequestPhotos t', prefixColumn: 't.request_id' },
  { table: 'SchoolClassResources', column: 'image_url', kind: 'scalar', container: CONTAINERS.schoolResources, from: 'dbo.SchoolClassResources t', prefixColumn: null },
  { table: 'LessonNotes', column: 'images_json', kind: 'strings', container: CONTAINERS.lessonNotes, from: 'dbo.LessonNotes t', prefixColumn: null },
  { table: 'Tasks', column: 'attachments_json', kind: 'objects', container: CONTAINERS.taskAttachments, from: 'dbo.Tasks t', prefixColumn: 't.student_id' },
  { table: 'Tasks', column: 'attachment_url', kind: 'scalar', container: CONTAINERS.taskAttachments, from: 'dbo.Tasks t', prefixColumn: 't.student_id' },
]

// NVARCHAR, SQL Server'da UTF-16LE saklanır; HASHBYTES bu baytlar üzerinden hesaplanır.
const sqlNvarcharHash = (value) => crypto.createHash('sha256').update(Buffer.from(value, 'utf16le')).digest()

function hasDataUrlCondition(source) {
  // SUBSTRING yalnızca LOB'un başını okur; S0'da LIKE '%...' tüm kolonu taradığı için zaman aşımına uğruyordu.
  return source.kind === 'scalar'
    ? `t.${source.column} IS NOT NULL AND SUBSTRING(t.${source.column}, 1, 5) = 'data:'`
    : `t.${source.column} IS NOT NULL AND CHARINDEX('data:', t.${source.column}) > 0`
}

/** Kolon değerindeki data URL'leri yükleyip referansla değiştirilmiş yeni değeri ve yüklenen referansları döner. */
async function convertValue(source, value, prefix, uploadCache) {
  const uploaded = []
  const convert = async (url) => {
    if (typeof url !== 'string' || !url.startsWith('data:')) return url
    const key = `${prefix || ''}|${crypto.createHash('sha256').update(url).digest('hex')}`
    if (!uploadCache.has(key)) {
      const ref = await storeDataUrl(url, { container: source.container, prefix })
      if (!isBlobRef(ref)) throw new Error('Depoya yüklenemedi (data URL biçimi?).')
      uploadCache.set(key, ref)
      uploaded.push(ref)
    }
    return uploadCache.get(key)
  }
  if (source.kind === 'scalar') return { next: await convert(value), uploaded }
  const list = JSON.parse(value)
  const next = await Promise.all(list.map((item) => (
    source.kind === 'strings' ? convert(item) : (async () => ({ ...item, url: await convert(item?.url) }))()
  )))
  return { next: JSON.stringify(next), uploaded }
}

async function migrate(pool) {
  const uploadCache = new Map()
  for (const source of SOURCES) {
    if (ONLY && ONLY !== source.table) continue
    const label = `${source.table}.${source.column}`
    const rows = (await pool.request().query(`
      SELECT t.id, ${source.prefixColumn || 'NULL'} AS prefix FROM ${source.from}
      WHERE ${hasDataUrlCondition(source)};
    `)).recordset.slice(0, LIMIT)
    console.log(`${label}: ${rows.length} satır taşınacak`)
    if (!APPLY) continue

    let moved = 0
    let skipped = 0
    let failed = 0
    for (const row of rows) {
      let uploaded = []
      try {
        const current = (await pool.request().input('id', sql.UniqueIdentifier, row.id)
          .query(`SELECT ${source.column} AS value FROM dbo.${source.table} WHERE id = @id;`)).recordset[0]?.value
        if (!current || !current.includes('data:')) {
          skipped += 1
          continue
        }
        const prefix = row.prefix ? String(row.prefix) : undefined
        const converted = await convertValue(source, current, prefix, uploadCache)
        uploaded = converted.uploaded
        const result = await pool.request()
          .input('id', sql.UniqueIdentifier, row.id)
          .input('next', sql.NVarChar(sql.MAX), converted.next)
          .input('hash', sql.VarBinary(32), sqlNvarcharHash(current))
          .query(`UPDATE dbo.${source.table} SET ${source.column} = @next
                  WHERE id = @id AND HASHBYTES('SHA2_256', ${source.column}) = @hash;`)
        if (result.rowsAffected[0] === 1) {
          moved += 1
        } else {
          skipped += 1
          throw new Error('Satır arada değişti; atlandı.')
        }
      } catch (error) {
        if (!/arada değişti/.test(error.message)) failed += 1
        // Bu satır için yeni yüklenen (önbellekte başka satıra verilmemiş) dosyaları geri al.
        for (const ref of uploaded) {
          await deleteBlobRef(ref)
          for (const [key, value] of uploadCache) if (value === ref) uploadCache.delete(key)
        }
        console.error(`  ${label} ${row.id}: ${error.message}`)
      }
      const done = moved + skipped + failed
      if (done % 50 === 0) console.log(`  ${label} ${done}/${rows.length}`)
    }
    console.log(`${label}: taşınan ${moved}, atlanan ${skipped}, hata ${failed}`)
  }
}

function collectRefs(source, value, refs) {
  if (!value) return
  if (source.kind === 'scalar') {
    if (isBlobRef(value)) refs.add(value)
    return
  }
  try {
    JSON.parse(value).forEach((item) => {
      const url = source.kind === 'strings' ? item : item?.url
      if (isBlobRef(url)) refs.add(url)
    })
  } catch {
    // bozuk JSON → referans yok sayılır
  }
}

async function cleanupOrphans(pool) {
  const refs = new Set()
  for (const source of SOURCES) {
    const condition = source.kind === 'scalar'
      ? `t.${source.column} IS NOT NULL AND SUBSTRING(t.${source.column}, 1, ${BLOB_REF_PREFIX.length}) = '${BLOB_REF_PREFIX}'`
      : `t.${source.column} IS NOT NULL AND CHARINDEX('${BLOB_REF_PREFIX}', t.${source.column}) > 0`
    const result = await pool.request().query(`SELECT t.${source.column} AS value FROM dbo.${source.table} t WHERE ${condition};`)
    result.recordset.forEach((row) => collectRefs(source, row.value, refs))
  }

  const service = BlobServiceClient.fromConnectionString(process.env.BLOB_CONNECTION_STRING)
  const orphans = []
  for (const container of new Set(SOURCES.map((source) => source.container))) {
    let total = 0
    let containerOrphans = 0
    for await (const blob of service.getContainerClient(container).listBlobsFlat()) {
      total += 1
      const ref = `${BLOB_REF_PREFIX}${container}/${blob.name}`
      const age = Date.now() - new Date(blob.properties.createdOn).getTime()
      if (!refs.has(ref) && age > ORPHAN_MIN_AGE_MS) {
        orphans.push(ref)
        containerOrphans += 1
      }
    }
    console.log(`${container}: ${total} dosya, başıboş ${containerOrphans}`)
  }
  console.log(`DB'de ${refs.size} farklı referans, toplam başıboş ${orphans.length}`)
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
