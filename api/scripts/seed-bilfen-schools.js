// One-off insert for Bilfen Ortaokul campuses (all İstanbul, private/"ozel").
// Usage: node api/scripts/seed-bilfen-schools.js
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
  ['Bilfen Ataşehir Ortaokulu', 'Ataşehir'],
  ['Bilfen Bahçeşehir Ortaokulu', 'Başakşehir'],
  ['Bilfen Çamlıca Ortaokulu', 'Üsküdar'],
  ['Bilfen Esenşehir Ortaokulu', 'Ümraniye'],
  ['Bilfen Halkalı Ortaokulu', 'Küçükçekmece'],
  ['Bilfen Koşuyolu Ortaokulu', 'Üsküdar'],
  ['Bilfen Kurtköy Ortaokulu', 'Tuzla'],
  ['Bilfen Maslak Ortaokulu', 'Sarıyer'],
  ['Bilfen Sancaktepe Ortaokulu', 'Sancaktepe'],
  ['Bilfen Yenişehir Ortaokulu', 'Ümraniye'],
]

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(connectionString)
  try {
    const provinceResult = await pool
      .request()
      .input('name', sql.NVarChar(50), 'İstanbul')
      .query('SELECT TOP 1 id FROM dbo.Provinces WHERE name = @name;')
    const provinceId = provinceResult.recordset[0]?.id
    if (!provinceId) throw new Error('İstanbul province not found.')

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
          ? `Added: ${name} (${districtName}/İstanbul)`
          : `Already exists: ${name} (${districtName}/İstanbul)`,
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
