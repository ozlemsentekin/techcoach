// Bilfen zincirindeki okullar arasında (school-resources.js'deki otomatik zincir
// kopyalama devreye girmeden önce) tek tek okullara eklenmiş kaynakları eşitler:
// herhangi bir Bilfen okulunda bulunan (grade, subject_id, name) kombinasyonu,
// eksik olduğu diğer tüm Bilfen okullarına da eklenir. Idempotent.
//
// Usage:
//   node api/scripts/backfill-bilfen-school-resources.js            # dry-run
//   node api/scripts/backfill-bilfen-school-resources.js --commit   # yaz
const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const COMMIT = process.argv.includes('--commit')

function loadLocalSettings() {
  const p = path.join(__dirname, '..', 'local.settings.json')
  const s = JSON.parse(fs.readFileSync(p, 'utf8'))
  Object.entries(s.Values || {}).forEach(([k, v]) => {
    if (!process.env[k] && typeof v === 'string') process.env[k] = v
  })
}

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const schools = (
      await pool.request().query(`
        SELECT id, name FROM dbo.Schools WHERE name LIKE N'%Bilfen%' AND is_active = 1 ORDER BY name;
      `)
    ).recordset
    console.log(`Bilfen okulu sayısı: ${schools.length}`)

    // Her (grade, subject_id, name) için en eski satırı "kaynak" seç (image_url dahil).
    const canonicalRows = (
      await pool.request().query(`
        SELECT grade, subject_id, name, image_url
        FROM (
          SELECT scr.grade, scr.subject_id, scr.name, scr.image_url,
                 ROW_NUMBER() OVER (PARTITION BY scr.grade, scr.subject_id, scr.name ORDER BY scr.created_at ASC) AS rn
          FROM dbo.SchoolClassResources scr
          JOIN dbo.Schools sc ON sc.id = scr.school_id
          WHERE sc.name LIKE N'%Bilfen%' AND sc.is_active = 1
        ) x
        WHERE rn = 1;
      `)
    ).recordset
    console.log(`Benzersiz kaynak kombinasyonu: ${canonicalRows.length}`)

    let inserted = 0
    let skipped = 0
    for (const row of canonicalRows) {
      const existing = new Set(
        (
          await pool
            .request()
            .input('g', sql.NVarChar(20), row.grade)
            .input('sid', sql.UniqueIdentifier, row.subject_id)
            .input('n', sql.NVarChar(200), row.name)
            .query(`
              SELECT scr.school_id
              FROM dbo.SchoolClassResources scr
              JOIN dbo.Schools sc ON sc.id = scr.school_id
              WHERE sc.name LIKE N'%Bilfen%' AND sc.is_active = 1
                AND scr.grade = @g AND scr.subject_id = @sid AND scr.name = @n;
            `)
        ).recordset.map((r) => r.school_id.toUpperCase()),
      )

      for (const school of schools) {
        if (existing.has(school.id.toUpperCase())) {
          continue
        }
        console.log(`  ${COMMIT ? 'EKLENIYOR' : '[dry-run]'}: [${row.grade}] "${row.name}" -> ${school.name}`)
        if (COMMIT) {
          await pool
            .request()
            .input('sid', sql.UniqueIdentifier, school.id)
            .input('g', sql.NVarChar(20), row.grade)
            .input('subj', sql.UniqueIdentifier, row.subject_id)
            .input('n', sql.NVarChar(200), row.name)
            .input('img', sql.NVarChar(sql.MAX), row.image_url)
            .query(`
              INSERT INTO dbo.SchoolClassResources (school_id, grade, subject_id, name, image_url)
              VALUES (@sid, @g, @subj, @n, @img);
            `)
        }
        inserted++
      }
      skipped += schools.length - (schools.length - Array.from(existing).length)
    }

    console.log(`\n${COMMIT ? 'Eklendi' : 'Eklenecek (dry-run)'}: ${inserted}`)
    if (!COMMIT) {
      console.log('Gerçek yazma için --commit ile tekrar çalıştırın.')
    }
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
