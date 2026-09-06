// Bir veliyi ve altındaki TÜM çocuk profillerini (+ bu kullanıcılara bağlı her kaydı) prod'dan
// kalıcı siler. Test hesaplarını temizlemek için. dbo.Users(id)'e referans veren tüm FK kolonları
// sys katalogundan dinamik bulunur: NOT NULL kolonlar için bağlı satır silinir, NULL kabul eden
// kolonlar NULL'a çekilir. Ordering (FK zinciri) için sweep birden çok kez tekrarlanır.
//
// Kullanım:
//   node api/scripts/hard-delete-parent-cascade.js "Hatun Özbay"            # dry-run (rollback)
//   node api/scripts/hard-delete-parent-cascade.js "Hatun Özbay" --commit   # kalıcı sil
//
// Not: prod'a bağlanmak için geçici Azure SQL firewall kuralı gerekebilir (bkz. memory db_access).
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

async function main() {
  const fullName = process.argv[2]
  const commit = process.argv.includes('--commit')
  if (!fullName) {
    console.error('Kullanım: node hard-delete-parent-cascade.js "<Ad Soyad>" [--commit]')
    process.exit(1)
  }

  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING eksik.')

  const pool = await sql.connect(connectionString)
  const tx = new sql.Transaction(pool)
  await tx.begin()
  try {
    // 1) Veliyi bul (isim + role='veli'). Tam olarak 1 eşleşme yoksa dur.
    const veliResult = await new sql.Request(tx)
      .input('name', sql.NVarChar(200), fullName)
      .query(`SELECT id, full_name, email, phone_number, role FROM dbo.Users
              WHERE full_name = @name AND role IN ('ebeveyn', 'veli') AND parent_id IS NULL;`)
    if (veliResult.recordset.length === 0) {
      throw new Error(`'${fullName}' adında bir veli bulunamadı.`)
    }
    if (veliResult.recordset.length > 1) {
      console.error('Birden fazla eşleşme var — hangisi olduğunu netleştirip id ile silin:')
      console.error(veliResult.recordset)
      throw new Error('Belirsiz eşleşme.')
    }
    const veli = veliResult.recordset[0]

    // 2) Alt çocuk profilleri.
    const childResult = await new sql.Request(tx)
      .input('veliId', sql.UniqueIdentifier, veli.id)
      .query(`SELECT id, full_name, email, role FROM dbo.Users WHERE parent_id = @veliId;`)

    const targetIds = [veli.id, ...childResult.recordset.map((r) => r.id)]

    console.log('Silinecek veli :', veli.full_name, '|', veli.email, '|', veli.phone_number, '|', veli.id)
    console.log('Silinecek çocuk profilleri:')
    childResult.recordset.forEach((c) => console.log('  -', c.full_name, '|', c.email, '|', c.id))
    console.log(`Toplam ${targetIds.length} kullanıcı satırı hedefleniyor.\n`)

    // 3) Hedef id'leri SQL literal IN-listesine çevir (id'ler DB'den geldi = güvenli GUID).
    const GUID_RE = /^[0-9A-Fa-f-]{36}$/
    for (const id of targetIds) {
      if (!GUID_RE.test(id)) throw new Error(`Beklenmeyen id formatı: ${id}`)
    }
    const targetsIn = targetIds.map((id) => `'${id}'`).join(', ')

    // 4) dbo.Users(id)'e referans veren tüm FK kolonları.
    const fkResult = await new sql.Request(tx).query(`
      SELECT OBJECT_SCHEMA_NAME(fk.parent_object_id) AS schema_name,
             OBJECT_NAME(fk.parent_object_id)        AS table_name,
             c.name                                  AS column_name,
             c.is_nullable                           AS is_nullable
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      JOIN sys.columns c  ON c.object_id  = fkc.parent_object_id     AND c.column_id  = fkc.parent_column_id
      JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
      WHERE fk.referenced_object_id = OBJECT_ID('dbo.Users') AND rc.name = 'id';
    `)
    const fkColumns = fkResult.recordset
    console.log(`dbo.Users'a referans veren ${fkColumns.length} FK kolonu bulundu.\n`)

    // 5) Sweep: NOT NULL → DELETE, NULL kabul eden → NULL'a çek. FK zinciri sırası için tekrarla.
    const totals = {}
    const MAX_PASSES = 8
    let pass = 0
    let pending = fkColumns.slice()

    while (pending.length && pass < MAX_PASSES) {
      pass += 1
      const stillPending = []
      let progressed = false

      for (const fk of pending) {
        const table = `[${fk.schema_name}].[${fk.table_name}]`
        const col = `[${fk.column_name}]`
        const key = `${fk.table_name}.${fk.column_name}`
        // dbo.Users'ın kendi self-ref kolonları (parent_id, funded_by_teacher_id): silinecek
        // satırlara dokunma, sadece hedef DIŞINDAKİ satırların referansını temizle.
        const selfRef = fk.table_name === 'Users'
        try {
          let query
          if (fk.is_nullable) {
            query = `UPDATE t SET t.${col} = NULL FROM ${table} t
                     WHERE t.${col} IN (${targetsIn})
                     ${selfRef ? `AND t.id NOT IN (${targetsIn})` : ''};`
          } else if (selfRef) {
            // NOT NULL self-ref beklenmiyor; olursa hedef-dışı satır kalırsa hata verir.
            query = `DELETE t FROM ${table} t
                     WHERE t.${col} IN (${targetsIn})
                     AND t.id NOT IN (${targetsIn});`
          } else {
            query = `DELETE t FROM ${table} t WHERE t.${col} IN (${targetsIn});`
          }
          const r = await new sql.Request(tx).query(query)
          const n = r.rowsAffected[0] || 0
          totals[key] = (totals[key] || 0) + n
          if (n > 0) progressed = true
        } catch (err) {
          if (err.number === 547) {
            stillPending.push(fk) // başka bir FK zincirini önce çözmek gerek
          } else {
            throw err
          }
        }
      }

      pending = stillPending
      if (pending.length && !progressed) {
        throw new Error(
          `FK zinciri çözülemedi (pass ${pass}). Kalan: ${pending.map((f) => `${f.table_name}.${f.column_name}`).join(', ')}`,
        )
      }
    }

    // 6) 1:1 hak satırları (PK = kullanıcı id) + kullanıcıların kendisi.
    const finalDeletes = [
      ['Entitlements', `DELETE FROM dbo.Entitlements WHERE parent_id IN (${targetsIn});`],
      ['TeacherEntitlements', `DELETE FROM dbo.TeacherEntitlements WHERE teacher_id IN (${targetsIn});`],
      ['Users', `DELETE FROM dbo.Users WHERE id IN (${targetsIn});`],
    ]
    for (const [label, query] of finalDeletes) {
      const r = await new sql.Request(tx).query(query)
      totals[label] = (totals[label] || 0) + (r.rowsAffected[0] || 0)
    }

    console.log('Etkilenen satırlar (tablo.kolon → adet):')
    Object.entries(totals)
      .filter(([, v]) => v > 0)
      .sort()
      .forEach(([k, v]) => console.log(`  ${k}: ${v}`))

    if (commit) {
      await tx.commit()
      console.log('\n✅ COMMIT edildi — kalıcı silindi.')
    } else {
      await tx.rollback()
      console.log('\n🟡 DRY-RUN — hiçbir şey silinmedi (rollback). Kalıcı silmek için --commit ekleyin.')
    }
  } catch (error) {
    try {
      await tx.rollback()
    } catch {
      /* zaten kapanmış olabilir */
    }
    console.error('\n❌ Hata — rollback yapıldı.')
    throw error
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
