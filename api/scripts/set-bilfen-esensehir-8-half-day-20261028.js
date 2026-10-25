// Bilfen Esenşehir Ortaokulu 8. sınıf şablonunda 28 Ekim 2026 Çarşamba (Cumhuriyet Bayramı arifesi,
// yarım gün) okul bitişini 11:40 yapar: 2026-09-07..2027-06-18 aralıklı çarşamba girdisini üçe böler.
// İdempotent — 28 Ekim girdisi zaten varsa bir şey yapmaz.
// Usage: node api/scripts/set-bilfen-esensehir-8-half-day-20261028.js [--apply]
const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const SCHOOL_ID = 'C3F4A9F4-9BBA-4C41-9B8D-B984F8DD65FB'
const GRADE = '8'
const HALF_DAY = '2026-10-28'

function loadLocalSettings() {
  const localSettingsPath = path.join(__dirname, '..', 'local.settings.json')
  if (!fs.existsSync(localSettingsPath)) return
  const parsed = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([key, value]) => {
    if (!process.env[key] && typeof value === 'string') process.env[key] = value
  })
}

async function main() {
  const apply = process.argv.includes('--apply')
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const result = await pool.request()
      .input('schoolId', sql.UniqueIdentifier, SCHOOL_ID)
      .input('grade', sql.NVarChar(20), GRADE)
      .query('SELECT schedule_json FROM dbo.SchoolClassSchedules WHERE school_id = @schoolId AND grade = @grade')
    const entries = JSON.parse(result.recordset[0]?.schedule_json || '[]')

    if (entries.some((e) => e.dayOfWeek === 'carsamba' && e.startDate === HALF_DAY && e.endDate === HALF_DAY)) {
      console.log('28 Ekim girdisi zaten var, değişiklik yok.')
      return
    }

    const index = entries.findIndex(
      (e) => e.dayOfWeek === 'carsamba' && e.startDate <= HALF_DAY && e.endDate >= HALF_DAY,
    )
    if (index === -1) throw new Error('28 Ekim\'i kapsayan çarşamba girdisi bulunamadı.')
    const base = entries[index]

    const replacement = [
      { ...base, endDate: '2026-10-27' },
      { ...base, endTime: '11:40', startDate: HALF_DAY, endDate: HALF_DAY },
      { ...base, startDate: '2026-10-29' },
    ]
    entries.splice(index, 1, ...replacement)
    console.log('Yeni çarşamba girdileri:', replacement)

    if (!apply) {
      console.log('Dry run — uygulamak için --apply ekleyin.')
      return
    }
    await pool.request()
      .input('schoolId', sql.UniqueIdentifier, SCHOOL_ID)
      .input('grade', sql.NVarChar(20), GRADE)
      .input('scheduleJson', sql.NVarChar(sql.MAX), JSON.stringify(entries))
      .query('UPDATE dbo.SchoolClassSchedules SET schedule_json = @scheduleJson WHERE school_id = @schoolId AND grade = @grade')
    console.log('Uygulandı.')
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
