// Adı içinde "Bilfen" geçen okullardan 3 tanesi aynı fiziksel okulun mükerrer kaydı
// (aynı ilçe, sadece kelime sırası farklı — "X Bilfen" vs "Bilfen X"). Kanonik kayıt
// diğer 10 okulla aynı konvansiyondaki "Bilfen X Ortaokulu" (2026-08-04 seed batch'i);
// mükerrer kayıtlar 2026-08-17'de eklenmiş.
//
// Her mükerrer için:
//   1. Bağlı öğrenci varsa StudentProfiles.school_id -> kanonik kayda taşınır.
//   2. Mükerrer kaydın child satırları silinir: SchoolClassResources (54),
//      SchoolClassSchedules (1), SchoolCalendarEntries (6).
//   3. dbo.Schools satırı silinir.
// Tümü tek transaction içinde. Tasks.school_resource_id ile mükerrer kaynaklara bağlı
// görev YOK (kontrol edildi); başka inbound FK yok.
//
// Usage:
//   node api/scripts/merge-duplicate-bilfen-schools.js            # dry-run
//   node api/scripts/merge-duplicate-bilfen-schools.js --commit
const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const COMMIT = process.argv.includes('--commit')

// [mükerrer (silinecek), kanonik (kalacak)]
const PAIRS = [
  {
    district: 'Ataşehir',
    duplicate: { id: '32DBA5E8-AC56-4C12-9751-2346A322554F', name: 'Ataşehir Bilfen Ortaokulu' },
    canonical: { id: '79B83E91-CC92-4F55-A723-BC03525CCC5F', name: 'Bilfen Ataşehir Ortaokulu' },
  },
  {
    district: 'Başakşehir',
    duplicate: { id: '59089502-DB98-4469-9F95-6730E6FB9969', name: 'Bahçeşehir Bilfen Ortaokulu' },
    canonical: { id: 'A9F22FF1-2C09-44AD-B6EC-B75CE025E678', name: 'Bilfen Bahçeşehir Ortaokulu' },
  },
  {
    district: 'Sancaktepe',
    duplicate: { id: '4C9BA271-36B7-4267-847E-90F27DFA060A', name: 'Sancaktepe Bilfen Ortaokulu' },
    canonical: { id: 'B42091CE-29ED-49CF-AB9F-630AAD05C9E8', name: 'Bilfen Sancaktepe Ortaokulu' },
  },
]

function load() {
  const s = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'local.settings.json'), 'utf8'))
  Object.entries(s.Values || {}).forEach(([k, v]) => { if (!process.env[k]) process.env[k] = v })
}

function poolConfig() {
  const cs = process.env.SQL_CONNECTION_STRING
  const get = (re) => (cs.match(re) || [])[1]
  return {
    server: get(/Server=tcp:([^,;]+)/i),
    port: Number(get(/,(\d+);/) || 1433),
    database: get(/Database=([^;]+)/i),
    user: get(/User ID=([^;]+)/i),
    password: get(/Password=([^;]+)/i),
    options: { encrypt: true, trustServerCertificate: false },
    connectionTimeout: 30000,
    requestTimeout: 120000,
  }
}

async function main() {
  load()
  const pool = await sql.connect(poolConfig())
  const tx = new sql.Transaction(pool)
  try {
    await tx.begin()
    for (const pair of PAIRS) {
      const dup = pair.duplicate.id
      const canon = pair.canonical.id

      // Sağlık kontrolü: her iki kayıt da var ve aynı ilçede mi?
      const check = (await new sql.Request(tx)
        .input('a', sql.UniqueIdentifier, dup)
        .input('b', sql.UniqueIdentifier, canon)
        .query(`SELECT id, name, district_id FROM dbo.Schools WHERE id IN (@a, @b)`)).recordset
      if (check.length !== 2) throw new Error(`${pair.district}: kayıtlardan biri yok (${check.length})`)
      if (check[0].district_id !== check[1].district_id) throw new Error(`${pair.district}: farklı ilçe`)

      const tasksRef = (await new sql.Request(tx).input('d', sql.UniqueIdentifier, dup).query(`
        SELECT COUNT(*) n FROM dbo.Tasks t
        JOIN dbo.SchoolClassResources r ON r.id = t.school_resource_id
        WHERE r.school_id = @d`)).recordset[0].n
      if (tasksRef > 0) throw new Error(`${pair.district}: mükerrer okulun kaynaklarına bağlı ${tasksRef} görev var — elle incele`)

      const movedStudents = (await new sql.Request(tx)
        .input('d', sql.UniqueIdentifier, dup)
        .input('c', sql.UniqueIdentifier, canon)
        .query(`
          UPDATE dbo.StudentProfiles SET school_id = @c WHERE school_id = @d;
          SELECT @@ROWCOUNT AS n;
        `)).recordset[0].n

      const delRes = (await new sql.Request(tx).input('d', sql.UniqueIdentifier, dup).query(`
        DELETE FROM dbo.SchoolClassResources WHERE school_id = @d;   SELECT @@ROWCOUNT AS resources;
      `)).recordset[0].resources
      const delSch = (await new sql.Request(tx).input('d', sql.UniqueIdentifier, dup).query(`
        DELETE FROM dbo.SchoolClassSchedules WHERE school_id = @d;   SELECT @@ROWCOUNT AS schedules;
      `)).recordset[0].schedules
      const delCal = (await new sql.Request(tx).input('d', sql.UniqueIdentifier, dup).query(`
        DELETE FROM dbo.SchoolCalendarEntries WHERE school_id = @d;  SELECT @@ROWCOUNT AS calendar;
      `)).recordset[0].calendar
      const delSchool = (await new sql.Request(tx).input('d', sql.UniqueIdentifier, dup).query(`
        DELETE FROM dbo.Schools WHERE id = @d;                       SELECT @@ROWCOUNT AS schools;
      `)).recordset[0].schools

      console.log(`${pair.district}: "${pair.duplicate.name}" -> "${pair.canonical.name}"`)
      console.log(`  öğrenci taşındı: ${movedStudents}, silinen kaynak: ${delRes}, program: ${delSch}, takvim: ${delCal}, okul: ${delSchool}`)
    }

    if (COMMIT) {
      await tx.commit()
      console.log('\nYAZILDI (commit).')
    } else {
      await tx.rollback()
      console.log('\nDRY-RUN (rollback). Yazmak için: --commit')
    }
  } catch (e) {
    try { await tx.rollback() } catch { /* rollback da başarısızsa asıl hatayı fırlat */ }
    throw e
  } finally {
    await pool.close()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
