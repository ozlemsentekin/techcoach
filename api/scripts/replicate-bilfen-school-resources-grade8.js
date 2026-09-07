// Aylin Şişman'ın okulu (Bilfen Esenşehir Ortaokulu) için tanımlı 8. sınıf "okul
// kaynakları" (dbo.SchoolClassResources) Bilfen'in kendi müfredat materyalleridir
// (Çalışma Defteri, Tam Öğrenme, Son Kontrol, Denemeye Değer, Föy ...). Bu satırları
// adı içinde "Bilfen" geçen TÜM okullara 8. sınıf okul kaynağı olarak kopyalar; böylece
// herhangi bir Bilfen okulundaki 8. sınıf öğrencisine "Okul Ödevi" eklenirken bu
// kaynaklar görünür (bkz. api/src/schoolResources.js — getPanelSchoolResourcesHandler
// / getTeacherStudentSchoolResourcesHandler, school_id + grade + subject_id ile sorgular).
//
// Idempotent: hedef okulda aynı (grade, subject_id, name) satırı varsa atlanır.
//
// Usage:
//   node api/scripts/replicate-bilfen-school-resources-grade8.js            # dry-run
//   node api/scripts/replicate-bilfen-school-resources-grade8.js --commit   # yaz
const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const SOURCE_SCHOOL_NAME = 'Bilfen Esenşehir Ortaokulu'
const GRADE = '8'
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
    const source = (
      await pool.request().input('n', sql.NVarChar(200), SOURCE_SCHOOL_NAME).query(`
        SELECT id, name FROM dbo.Schools WHERE name = @n;
      `)
    ).recordset[0]
    if (!source) throw new Error(`Kaynak okul bulunamadı: ${SOURCE_SCHOOL_NAME}`)

    const sourceRows = (
      await pool.request().input('sid', sql.UniqueIdentifier, source.id).input('g', sql.NVarChar(20), GRADE).query(`
        SELECT subject_id, grade, name, image_url, is_active
        FROM dbo.SchoolClassResources
        WHERE school_id = @sid AND grade = @g
        ORDER BY name;
      `)
    ).recordset
    console.log(`Kaynak: ${source.name} — ${GRADE}. sınıf ${sourceRows.length} okul kaynağı`)

    const targets = (
      await pool.request().input('src', sql.UniqueIdentifier, source.id).query(`
        SELECT id, name FROM dbo.Schools
        WHERE name LIKE N'%Bilfen%' AND id <> @src
        ORDER BY name;
      `)
    ).recordset
    console.log(`Hedef Bilfen okulları: ${targets.length}\n`)

    let inserted = 0
    let skipped = 0
    for (const school of targets) {
      const existing = new Set(
        (
          await pool
            .request()
            .input('sid', sql.UniqueIdentifier, school.id)
            .input('g', sql.NVarChar(20), GRADE)
            .query(`
              SELECT subject_id, name FROM dbo.SchoolClassResources
              WHERE school_id = @sid AND grade = @g;
            `)
        ).recordset.map((r) => `${r.subject_id}::${r.name}`),
      )

      let schoolInserted = 0
      for (const row of sourceRows) {
        const key = `${row.subject_id}::${row.name}`
        if (existing.has(key)) {
          skipped++
          continue
        }
        if (COMMIT) {
          await pool
            .request()
            .input('schoolId', sql.UniqueIdentifier, school.id)
            .input('grade', sql.NVarChar(20), row.grade)
            .input('subjectId', sql.UniqueIdentifier, row.subject_id)
            .input('name', sql.NVarChar(200), row.name)
            .input('imageUrl', sql.NVarChar(sql.MAX), row.image_url)
            .input('isActive', sql.Bit, row.is_active)
            .query(`
              INSERT INTO dbo.SchoolClassResources (school_id, grade, subject_id, name, image_url, is_active)
              VALUES (@schoolId, @grade, @subjectId, @name, @imageUrl, @isActive);
            `)
        }
        inserted++
        schoolInserted++
      }
      console.log(`  ${school.name}: +${schoolInserted} (mevcut ${sourceRows.length - schoolInserted} atlandı)`)
    }

    console.log(`\n${COMMIT ? 'YAZILDI' : 'DRY-RUN'} — eklenecek: ${inserted}, atlanan (zaten var): ${skipped}`)
    if (!COMMIT) console.log('Yazmak için: --commit')
  } finally {
    await pool.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
