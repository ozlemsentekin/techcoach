// Verilen kullanıcıları (isim veya id ile) ve bunlara bağlı TÜM kayıtları prod'dan kalıcı siler.
// Test/yanlış hesapları temizlemek için. dbo.Users(id)'e referans veren tüm FK kolonları sys
// katalogundan dinamik bulunur: NOT NULL kolonlar için bağlı satır silinir, NULL kabul eden
// kolonlar NULL'a çekilir. FK zinciri sırası için sweep birden çok kez tekrarlanır.
//
// hard-delete-parent-cascade.js'den farkı: role/parent_id filtresi yok — herhangi bir rol
// (öğretmen, öğrenci, veli, admin) hedeflenebilir, birden çok kullanıcı tek işlemde silinebilir.
// parent_id'si hedeflerden birine işaret eden çocuk profilleri de otomatik dahil edilir.
//
// Kullanım:
//   node api/scripts/hard-delete-users-cascade.js "Hatun Özbay" "İpek Özbay"            # dry-run
//   node api/scripts/hard-delete-users-cascade.js "Hatun Özbay" "İpek Özbay" --commit   # kalıcı sil
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

const GUID_RE = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/

async function main() {
  const commit = process.argv.includes('--commit')
  const identifiers = process.argv.slice(2).filter((a) => a !== '--commit')
  if (identifiers.length === 0) {
    console.error('Kullanım: node hard-delete-users-cascade.js "<Ad Soyad|id>" [...] [--commit]')
    process.exit(1)
  }

  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING eksik.')

  const pool = await sql.connect(connectionString)
  const tx = new sql.Transaction(pool)
  await tx.begin()
  try {
    // 1) Her identifier'ı tam 1 kullanıcıya çöz.
    const resolved = []
    for (const ident of identifiers) {
      const isGuid = GUID_RE.test(ident)
      const r = await new sql.Request(tx)
        .input('v', sql.NVarChar(200), ident)
        .query(
          isGuid
            ? `SELECT id, full_name, email, phone_number, role, parent_id FROM dbo.Users WHERE id = @v;`
            : `SELECT id, full_name, email, phone_number, role, parent_id FROM dbo.Users WHERE full_name = @v;`,
        )
      if (r.recordset.length === 0) throw new Error(`'${ident}' bulunamadı.`)
      if (r.recordset.length > 1) {
        console.error(r.recordset)
        throw new Error(`'${ident}' için birden fazla eşleşme — id ile belirtin.`)
      }
      resolved.push(r.recordset[0])
    }

    const targetSet = new Map(resolved.map((u) => [u.id, u]))

    // 2) parent_id'si hedeflerden birine işaret eden çocuk profillerini dahil et.
    for (const u of resolved) {
      const kids = await new sql.Request(tx)
        .input('pid', sql.UniqueIdentifier, u.id)
        .query(`SELECT id, full_name, email, role, parent_id FROM dbo.Users WHERE parent_id = @pid;`)
      kids.recordset.forEach((k) => {
        if (!targetSet.has(k.id)) targetSet.set(k.id, k)
      })
    }

    const targetIds = [...targetSet.keys()]
    console.log('Silinecek kullanıcılar:')
    ;[...targetSet.values()].forEach((u) =>
      console.log(`  - ${u.full_name} | ${u.role} | ${u.email || '—'} | ${u.phone_number || '—'} | ${u.id}`),
    )
    console.log(`Toplam ${targetIds.length} kullanıcı satırı.\n`)

    for (const id of targetIds) {
      if (!GUID_RE.test(id)) throw new Error(`Beklenmeyen id: ${id}`)
    }
    const targetsIn = targetIds.map((id) => `'${id}'`).join(', ')

    // 3) dbo.Users(id)'e referans veren tüm FK kolonları.
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

    // 4) Sweep: NOT NULL → DELETE, NULL kabul eden → NULL. FK zinciri sırası için tekrarla.
    const totals = {}
    const MAX_PASSES = 10
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
        const selfRef = fk.table_name === 'Users'
        try {
          let query
          if (fk.is_nullable) {
            query = `UPDATE t SET t.${col} = NULL FROM ${table} t
                     WHERE t.${col} IN (${targetsIn})
                     ${selfRef ? `AND t.id NOT IN (${targetsIn})` : ''};`
          } else if (selfRef) {
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
            stillPending.push(fk)
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

    // 5) 1:1 hak satırları + kullanıcıların kendisi.
    const finalDeletes = [
      ['Entitlements', `DELETE FROM dbo.Entitlements WHERE parent_id IN (${targetsIn});`],
      ['TeacherEntitlements', `DELETE FROM dbo.TeacherEntitlements WHERE teacher_id IN (${targetsIn});`],
      ['Users', `DELETE FROM dbo.Users WHERE id IN (${targetsIn});`],
    ]
    for (const [label, query] of finalDeletes) {
      try {
        const r = await new sql.Request(tx).query(query)
        totals[label] = (totals[label] || 0) + (r.rowsAffected[0] || 0)
      } catch (err) {
        if (err.number === 208) continue // tablo yok
        throw err
      }
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
