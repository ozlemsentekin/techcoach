const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const localSettingsPath = path.join(__dirname, '..', 'local.settings.json')

function loadLocalSettings() {
  if (!fs.existsSync(localSettingsPath)) {
    return
  }

  const parsed = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))

  Object.entries(parsed.Values || {}).forEach(([key, value]) => {
    if (!process.env[key] && typeof value === 'string') {
      process.env[key] = value
    }
  })
}

const NEW_FEATURES = [
  '4 öğrenciye kadar tam erişim — ek öğrenci 299 TL / ay',
  'Kaynak ve ilerleme takibi',
  'Test, deneme ve konu bazlı gelişim analizi',
  'Dijital hata defteri ve yanlış soru takibi',
  'Görev oluşturma ve tamamlanma takibi',
  'Öğrenci–kaynak eşleştirme',
  'Veli ve öğrenciyle ortak gelişim takibi',
]

async function main() {
  loadLocalSettings()

  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) {
    throw new Error('SQL_CONNECTION_STRING is missing.')
  }

  const pool = await sql.connect(connectionString)

  try {
    const before = await pool.request()
      .input('planKey', sql.NVarChar, 'teacher')
      .query('SELECT plan_key, features_json, note FROM dbo.PricingPlans WHERE plan_key = @planKey')

    if (before.recordset.length === 0) {
      throw new Error('teacher plan row not found in dbo.PricingPlans')
    }

    console.log('Current features_json:', before.recordset[0].features_json)
    console.log('Current note:', before.recordset[0].note)

    const newFeaturesJson = JSON.stringify(NEW_FEATURES)

    await pool.request()
      .input('planKey', sql.NVarChar, 'teacher')
      .input('featuresJson', sql.NVarChar(sql.MAX), newFeaturesJson)
      .query('UPDATE dbo.PricingPlans SET features_json = @featuresJson, note = NULL WHERE plan_key = @planKey')

    const after = await pool.request()
      .input('planKey', sql.NVarChar, 'teacher')
      .query('SELECT plan_key, features_json, note FROM dbo.PricingPlans WHERE plan_key = @planKey')

    console.log('Updated features_json:', after.recordset[0].features_json)
    console.log('Updated note:', after.recordset[0].note)
    console.log('Done.')
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Update failed')
  console.error(error.message)
  process.exit(1)
})
