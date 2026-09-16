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
  '2 öğrenciye kadar tam erişim',
  'Haftalık plan ve günlük görev takibi',
  'Kaynak ilerleme ve başarı oranları',
  'Test, deneme ve konu bazlı gelişim analizi',
  'Dijital hata defteri ve PDF çıktısı',
  'Veli hesabından sonuç ve görev yönetimi',
  'Varsa özel öğretmenle ortak takip',
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
      .input('planKey', sql.NVarChar, 'parent')
      .query('SELECT plan_key, features_json FROM dbo.PricingPlans WHERE plan_key = @planKey')

    if (before.recordset.length === 0) {
      throw new Error('parent plan row not found in dbo.PricingPlans')
    }

    console.log('Current features_json:', before.recordset[0].features_json)

    const newFeaturesJson = JSON.stringify(NEW_FEATURES)

    await pool.request()
      .input('planKey', sql.NVarChar, 'parent')
      .input('featuresJson', sql.NVarChar(sql.MAX), newFeaturesJson)
      .query('UPDATE dbo.PricingPlans SET features_json = @featuresJson WHERE plan_key = @planKey')

    const after = await pool.request()
      .input('planKey', sql.NVarChar, 'parent')
      .query('SELECT plan_key, features_json FROM dbo.PricingPlans WHERE plan_key = @planKey')

    console.log('Updated features_json:', after.recordset[0].features_json)
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
