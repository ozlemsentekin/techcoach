// One-off insert for Sakarya private (ozel) ortaokul campuses.
// Source: https://www.bilimsenligi.com/sakarya-ozel-okullar-ve-kolejler-listesi.html/
// Usage: node api/scripts/seed-sakarya-schools.js
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

const SCHOOLS = [
  ['Özel Enka Ortaokulu', 'Adapazarı'],
  ['Özel Şahin Ortaokulu', 'Adapazarı'],
  ['Özel Ada Anka Ortaokulu', 'Adapazarı'],
  ['Özel Ada Şafak Ortaokulu', 'Adapazarı'],
  ['Özel Adabilim Ortaokulu', 'Adapazarı'],
  ['Özel Bilnet Ortaokulu', 'Adapazarı'],
  ['Özel Doğa Ortaokulu', 'Adapazarı'],
  ['Özel Irak Al-Najah Milletlerarası Ortaokulu', 'Adapazarı'],
  ['Özel Sakarya Bahçeşehir Koleji Ortaokulu', 'Adapazarı'],
  ['Özel Sakarya Maya Ortaokulu', 'Adapazarı'],
  ['Özel Sakarya Uğur Ortaokulu', 'Adapazarı'],
  ['Ted Sakarya Koleji Ortaokulu', 'Adapazarı'],
  ['Özel Erenler Güneş Ortaokulu', 'Erenler'],
  ['Özel Irak Al Nawaris Milletlerarası Ortaokulu', 'Erenler'],
  ['Özel Mefkure Ortaokulu', 'Erenler'],
  ['Özel Tümel Evrensel Bilgi Ortaokulu', 'Erenler'],
  ['Özel Hendek İmge Ortaokulu', 'Hendek'],
  ['Özel Karasu Koleji Ortaokulu', 'Karasu'],
  ['Özel Özşen Ortaokulu', 'Karasu'],
  ['Özel Altinküre Ortaokulu', 'Serdivan'],
  ['Özel Beşsekiz Ortaokulu', 'Serdivan'],
  ['Özel Bil Sakarya Ortaokulu', 'Serdivan'],
  ['Özel Doruk Ortaokulu', 'Serdivan'],
  ['Özel Final Akademi Ortaokulu', 'Serdivan'],
  ['Özel Irak Al Hayat Milletlerarası Ortaokulu', 'Serdivan'],
  ['Özel Neva Ortaokulu', 'Serdivan'],
  ['Özel Sakarya Açılım Ortaokulu', 'Serdivan'],
  ['Özel Sakarya İlke Ortaokulu', 'Serdivan'],
  ['Özel Serdivan Kale Ortaokulu', 'Serdivan'],
  ['Özel Serdivan Teksen Ortaokulu', 'Serdivan'],
  ['Sakarya Üniversitesi Vakfı Özel Ortaokulu', 'Serdivan'],
]

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(connectionString)
  try {
    const provinceResult = await pool
      .request()
      .input('name', sql.NVarChar(50), 'Sakarya')
      .query('SELECT TOP 1 id FROM dbo.Provinces WHERE name = @name;')
    const provinceId = provinceResult.recordset[0]?.id
    if (!provinceId) throw new Error('Sakarya province not found.')

    for (const [name, districtName] of SCHOOLS) {
      const districtResult = await pool
        .request()
        .input('provinceId', sql.UniqueIdentifier, provinceId)
        .input('districtName', sql.NVarChar(50), districtName)
        .query('SELECT TOP 1 id FROM dbo.Districts WHERE province_id = @provinceId AND name = @districtName;')
      const districtId = districtResult.recordset[0]?.id
      if (!districtId) {
        console.error(`SKIP: district not found for ${name} (${districtName})`)
        continue
      }

      const insertResult = await pool
        .request()
        .input('provinceId', sql.UniqueIdentifier, provinceId)
        .input('districtId', sql.UniqueIdentifier, districtId)
        .input('name', sql.NVarChar(200), name)
        .input('schoolType', sql.NVarChar(20), 'ozel')
        .query(`
          INSERT INTO dbo.Schools (province_id, district_id, name, school_type)
          SELECT @provinceId, @districtId, @name, @schoolType
          WHERE NOT EXISTS (
            SELECT 1 FROM dbo.Schools WHERE district_id = @districtId AND name = @name
          );
        `)

      console.log(
        insertResult.rowsAffected[0] > 0
          ? `Added: ${name} (${districtName}/Sakarya)`
          : `Already exists: ${name} (${districtName}/Sakarya)`,
      )
    }
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
