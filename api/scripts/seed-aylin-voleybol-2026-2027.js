// Aylin Şişman için 2026-2027 sezonu voleybol antrenman (spor) görevlerini planlar.
//   - Pazartesi & Perşembe: 19:45-20:45, not: "Voleybol antrenmanımız vardır 19:15 de evden çıkacağız."
//   - Cumartesi: 18:00-19:00, not: "Voleybol antrenmanımız vardır 17:30 da evden çıkacağız."
// Aralık: bugünden (dahil değil, yarından) 2027-06-30'a kadar (dahil).
// Idempotent: o güne ait bir 'spor' görevi zaten varsa o gün atlanır.
//
// Kullanım:
//   node api/scripts/seed-aylin-voleybol-2026-2027.js            # önizleme (dry-run)
//   node api/scripts/seed-aylin-voleybol-2026-2027.js --commit   # veritabanına yazar
const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const localSettingsPath = path.join(__dirname, '..', 'local.settings.json')
function loadLocalSettings() {
  if (!fs.existsSync(localSettingsPath)) return
  const parsed = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([k, v]) => {
    if (!process.env[k] && typeof v === 'string') process.env[k] = v
  })
}

const COMMIT = process.argv.includes('--commit')

const STUDENT_ID = '427246B1-A97D-4611-B393-D5F6C1AB6915' // Aylin Şişman
const PARENT_USER_ID = 'A0AD5E68-8DFB-40D3-B9B9-AD587E2BF5B2' // Özlem Şişman (veli)

const RANGE_START = '2026-09-07' // dahil (bugün 2026-09-06 Pazar; ilk Pazartesi)
const RANGE_END = '2027-06-30' // dahil

const WEEKDAY_NOTE = 'Voleybol antrenmanımız vardır 19:15 de evden çıkacağız.'
const SATURDAY_NOTE = 'Voleybol antrenmanımız vardır 17:30 da evden çıkacağız.'

// getDay(): 0=Paz, 1=Pzt, 2=Sal, 3=Çar, 4=Per, 5=Cum, 6=Cmt
const PLAN_BY_DOW = {
  1: { start: '19:45', end: '20:45', note: WEEKDAY_NOTE }, // Pazartesi
  4: { start: '19:45', end: '20:45', note: WEEKDAY_NOTE }, // Perşembe
  6: { start: '18:00', end: '19:00', note: SATURDAY_NOTE }, // Cumartesi
}

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

function buildOccurrences() {
  const out = []
  const cur = new Date(`${RANGE_START}T00:00:00Z`)
  const end = new Date(`${RANGE_END}T00:00:00Z`)
  while (cur <= end) {
    const plan = PLAN_BY_DOW[cur.getUTCDay()]
    if (plan) {
      out.push({
        date: isoDate(cur),
        startTime: plan.start,
        endTime: plan.end,
        note: plan.note,
      })
    }
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const occurrences = buildOccurrences()

    const existing = await pool
      .request()
      .input('sid', sql.UniqueIdentifier, STUDENT_ID)
      .input('from', sql.Date, RANGE_START)
      .input('to', sql.Date, RANGE_END)
      .query(`
        SELECT date FROM dbo.Tasks
        WHERE student_id = @sid AND task_type = 'spor' AND date BETWEEN @from AND @to;
      `)
    const existingDates = new Set(existing.recordset.map((r) => isoDate(new Date(r.date))))

    const toInsert = occurrences.filter((o) => !existingDates.has(o.date))
    const skipped = occurrences.length - toInsert.length

    console.log(`Aralık: ${RANGE_START} → ${RANGE_END}`)
    console.log(`Planlanan gün sayısı: ${occurrences.length} (zaten var: ${skipped}, eklenecek: ${toInsert.length})`)
    const byDow = { 1: 0, 4: 0, 6: 0 }
    toInsert.forEach((o) => { byDow[new Date(`${o.date}T00:00:00Z`).getUTCDay()]++ })
    console.log(`  Pazartesi: ${byDow[1]}, Perşembe: ${byDow[4]}, Cumartesi: ${byDow[6]}`)
    if (toInsert.length) {
      console.log(`  İlk: ${toInsert[0].date} ${toInsert[0].startTime}-${toInsert[0].endTime}`)
      console.log(`  Son: ${toInsert[toInsert.length - 1].date} ${toInsert[toInsert.length - 1].startTime}-${toInsert[toInsert.length - 1].endTime}`)
    }

    if (!COMMIT) {
      console.log('\nDRY-RUN. Yazmak için: node api/scripts/seed-aylin-voleybol-2026-2027.js --commit')
      return
    }
    if (!toInsert.length) {
      console.log('\nEklenecek görev yok.')
      return
    }

    let inserted = 0
    for (const o of toInsert) {
      await pool
        .request()
        .input('sid', sql.UniqueIdentifier, STUDENT_ID)
        .input('date', sql.Date, o.date)
        .input('title', sql.NVarChar(200), 'Spor')
        .input('taskType', sql.NVarChar(40), 'spor')
        .input('startTime', sql.Char(5), o.startTime)
        .input('endTime', sql.Char(5), o.endTime)
        .input('durationMinutes', sql.Int, 60)
        .input('priority', sql.NVarChar(20), 'orta')
        .input('status', sql.NVarChar(30), 'bekliyor')
        .input('description', sql.NVarChar(1000), o.note)
        .input('createdBy', sql.NVarChar(20), 'ebeveyn')
        .input('createdByUserId', sql.UniqueIdentifier, PARENT_USER_ID)
        .query(`
          INSERT INTO dbo.Tasks
            (student_id, is_draft, date, title, task_type, start_time, end_time,
             duration_minutes, priority, status, description, created_by, created_by_user_id)
          VALUES
            (@sid, 0, @date, @title, @taskType, @startTime, @endTime,
             @durationMinutes, @priority, @status, @description, @createdBy, @createdByUserId);
        `)
      inserted++
    }
    console.log(`\nEklenen görev: ${inserted}`)
  } finally {
    await pool.close()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
