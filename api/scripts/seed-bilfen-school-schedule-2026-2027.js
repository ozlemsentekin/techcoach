// Adı içinde "Bilfen" geçen tüm okullar için 2026-2027 öğretim yılı okul ders saati
// şablonunu (dbo.SchoolClassSchedules) ve resmi tatil takvimini (dbo.SchoolCalendarEntries)
// oluşturur. Bu okullarda okuyan öğrencilerin haftalık planında bu saatler "Okulda" görünür.
//
//   - Pazartesi–Perşembe: 08:00–16:30
//   - Cuma:               08:00–15:00
//   - 2026-09-07 → 2027-06-18 (dahil)
//   - Eylül hafta sonu ek günleri:
//       * Cumartesi 12 / 19 / 26 Eylül 2026: 08:30–13:30
//       * Pazar 20 Eylül 2026:               09:00–14:00
//   - Resmi tatillerde okul gösterilmez (SchoolCalendarEntries). Arefe günleri (28 Eki,
//     8 Mar, 15 May) tam gün kapalı işaretlenir — sistemde yarım gün ayrımı yok.
//   - Yarıyıl (sömestr) tatili bilinçli olarak EKLENMEDİ; talep "sadece resmi tatiller".
//
// Sınıflar: yalnızca 8 (şu an Bilfen okullarında öğrencisi olan tek sınıf).
//
// Idempotent: aynı okul+sınıf şablonu ve aynı tatil kaydı varsa tekrar yazılmaz;
// mevcut şablondaki geçmiş (2026-09-08 öncesi biten) girdiler korunur.
//
// Kullanım:
//   node api/scripts/seed-bilfen-school-schedule-2026-2027.js            # önizleme (dry-run)
//   node api/scripts/seed-bilfen-school-schedule-2026-2027.js --commit   # veritabanına yazar
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

const TERM_START = '2026-09-07' // ilk Pazartesi (bugün 2026-09-06 Pazar)
const TERM_END = '2027-06-18' // dahil
const GRADES = ['8']

const WEEKDAY_SLOTS = [
  { dayOfWeek: 'pazartesi', startTime: '08:00', endTime: '16:30' },
  { dayOfWeek: 'sali', startTime: '08:00', endTime: '16:30' },
  { dayOfWeek: 'carsamba', startTime: '08:00', endTime: '16:30' },
  { dayOfWeek: 'persembe', startTime: '08:00', endTime: '16:30' },
  { dayOfWeek: 'cuma', startTime: '08:00', endTime: '15:00' },
].map((s) => ({ ...s, lessonName: null, startDate: TERM_START, endDate: TERM_END }))

const WEEKEND_SLOTS = [
  { dayOfWeek: 'cumartesi', startTime: '08:30', endTime: '13:30', date: '2026-09-12' },
  { dayOfWeek: 'cumartesi', startTime: '08:30', endTime: '13:30', date: '2026-09-19' },
  { dayOfWeek: 'cumartesi', startTime: '08:30', endTime: '13:30', date: '2026-09-26' },
  { dayOfWeek: 'pazar', startTime: '09:00', endTime: '14:00', date: '2026-09-20' },
].map((s) => ({
  dayOfWeek: s.dayOfWeek,
  startTime: s.startTime,
  endTime: s.endTime,
  lessonName: null,
  startDate: s.date,
  endDate: s.date,
}))

const NEW_SLOTS = [...WEEKDAY_SLOTS, ...WEEKEND_SLOTS]

// 2026-2027 öğretim yılı (2026-09-08 → 2027-06-18) aralığındaki resmi tatiller.
// Kaynak: Diyanet 2027 dini günler takvimi + 2429 sayılı kanun.
const HOLIDAYS = [
  { startDate: '2026-10-29', endDate: '2026-10-29', name: 'Cumhuriyet Bayramı' },
  { startDate: '2027-01-01', endDate: '2027-01-01', name: 'Yılbaşı' },
  { startDate: '2027-03-08', endDate: '2027-03-11', name: 'Ramazan Bayramı' },
  { startDate: '2027-04-23', endDate: '2027-04-23', name: 'Ulusal Egemenlik ve Çocuk Bayramı' },
  { startDate: '2027-05-01', endDate: '2027-05-01', name: 'Emek ve Dayanışma Günü' },
  { startDate: '2027-05-15', endDate: '2027-05-19', name: 'Kurban Bayramı (19 Mayıs dahil)' },
]

function parseEntries(value) {
  if (!value) return []
  try {
    const p = JSON.parse(value)
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

function sameSlot(a, b) {
  return (
    a.dayOfWeek === b.dayOfWeek &&
    a.startTime === b.startTime &&
    a.endTime === b.endTime &&
    (a.lessonName || null) === (b.lessonName || null) &&
    (a.startDate || null) === (b.startDate || null) &&
    (a.endDate || null) === (b.endDate || null)
  )
}

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const schools = (
      await pool.request().query("SELECT id, name FROM dbo.Schools WHERE name LIKE '%Bilfen%' ORDER BY name;")
    ).recordset

    console.log(`Bilfen okulu: ${schools.length}`)
    console.log(`Ders saatleri: Pzt–Per 08:00–16:30, Cuma 08:00–15:00 (${TERM_START} → ${TERM_END})`)
    console.log(`Hafta sonu: Cmt 12/19/26 Eyl 08:30–13:30, Paz 20 Eyl 09:00–14:00`)
    console.log(`Sınıflar: ${GRADES.join(', ')}`)
    console.log(`Resmi tatil kaydı: ${HOLIDAYS.length} (okul başına)\n`)

    let scheduleWrites = 0
    let holidayWrites = 0

    for (const school of schools) {
      for (const grade of GRADES) {
        const existing = parseEntries(
          (
            await pool
              .request()
              .input('sid', sql.UniqueIdentifier, school.id)
              .input('grade', sql.NVarChar(20), grade)
              .query('SELECT schedule_json FROM dbo.SchoolClassSchedules WHERE school_id = @sid AND grade = @grade;')
          ).recordset[0]?.schedule_json,
        )

        // Geçmişte kalan (2026-09-08'den önce biten) girdileri koru, gerisini yeni şablonla değiştir.
        const preserved = existing.filter((e) => e.endDate && e.endDate < TERM_START)
        const next = [...preserved, ...NEW_SLOTS]

        const unchanged =
          existing.length === next.length && existing.every((e, i) => sameSlot(e, next[i]))
        if (unchanged) continue

        scheduleWrites++
        if (COMMIT) {
          await pool
            .request()
            .input('sid', sql.UniqueIdentifier, school.id)
            .input('grade', sql.NVarChar(20), grade)
            .input('json', sql.NVarChar(sql.MAX), JSON.stringify(next))
            .query(`
              MERGE dbo.SchoolClassSchedules AS target
              USING (SELECT @sid AS school_id, @grade AS grade) AS src
              ON target.school_id = src.school_id AND target.grade = src.grade
              WHEN MATCHED THEN UPDATE SET schedule_json = @json
              WHEN NOT MATCHED THEN INSERT (school_id, grade, schedule_json) VALUES (@sid, @grade, @json);
            `)
        }
      }

      const existingHolidays = (
        await pool
          .request()
          .input('sid', sql.UniqueIdentifier, school.id)
          .query(`
            SELECT CONVERT(char(10), start_date, 23) s, CONVERT(char(10), end_date, 23) e, name
            FROM dbo.SchoolCalendarEntries WHERE school_id = @sid;
          `)
      ).recordset

      for (const h of HOLIDAYS) {
        const dup = existingHolidays.some((x) => x.s === h.startDate && x.e === h.endDate)
        if (dup) continue
        holidayWrites++
        if (COMMIT) {
          await pool
            .request()
            .input('sid', sql.UniqueIdentifier, school.id)
            .input('s', sql.Date, h.startDate)
            .input('e', sql.Date, h.endDate)
            .input('name', sql.NVarChar(200), h.name)
            .query(`
              INSERT INTO dbo.SchoolCalendarEntries (school_id, entry_type, start_date, end_date, name)
              VALUES (@sid, 'tatil', @s, @e, @name);
            `)
        }
      }
    }

    console.log(`Yazılacak/yazılan okul+sınıf şablonu: ${scheduleWrites}`)
    console.log(`Yazılacak/yazılan resmi tatil kaydı: ${holidayWrites}`)
    if (!COMMIT) {
      console.log('\nDRY-RUN. Yazmak için: node api/scripts/seed-bilfen-school-schedule-2026-2027.js --commit')
    } else {
      console.log('\nTAMAMLANDI.')
    }
  } finally {
    await pool.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
