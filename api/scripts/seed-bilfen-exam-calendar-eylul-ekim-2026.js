// Adı içinde "Bilfen" geçen tüm okullar için Eylül-Ekim 2026 sınav/izleme takvimini
// (dbo.SchoolCalendarEntries, entry_type='sinav') ekler. Bu kayıtlar bir GÖREV değildir;
// haftalık plan/ajanda görünümünde saat aralığı gösteren salt okunur bir bilgi kartı olarak
// görünür (bkz. src/panels/parent/components/WeeklyPlannerGrid.jsx SchoolSlotCard isExam).
//
// Kaynak: veli tarafından gönderilen okul ajandası görseli (Eylül 2026). Görseldeki "KURS" ve
// "Veli Toplantısı" kayıtları bilinçli olarak EKLENMEDİ (kullanıcı talebi); "Öğretim Yılı
// Başlangıcı" bir sınav olmadığı için eklenmedi.
//
// Saat kuralları (kullanıcı ile netleştirildi):
//   - Hafta içi, başında ders adı yazan "... İZLEME" kayıtları: 09:20-10:00
//   - Cumartesi günü "TMFSDİ İZLEME DEĞ.": 09:00-11:50
//   - 5 Ekim 2026 (Pazartesi) "TMFSDİ İZLEME DEĞ.": 09:20-12:10 (istisna, kullanıcı onayı)
//
// Idempotent: aynı okul + aynı tarih + aynı ad için kayıt zaten varsa tekrar yazılmaz.
//
// Kullanım:
//   node api/scripts/seed-bilfen-exam-calendar-eylul-ekim-2026.js            # önizleme (dry-run)
//   node api/scripts/seed-bilfen-exam-calendar-eylul-ekim-2026.js --commit   # veritabanına yazar
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

const EXAMS = [
  { date: '2026-09-12', name: 'TMFSDİ İzleme Değerlendirmesi', startTime: '09:00', endTime: '11:50' },
  { date: '2026-09-14', name: 'Türkçe İzleme', startTime: '09:20', endTime: '10:00' },
  { date: '2026-09-17', name: 'Matematik İzleme', startTime: '09:20', endTime: '10:00' },
  { date: '2026-09-21', name: 'Fen İzleme', startTime: '09:20', endTime: '10:00' },
  { date: '2026-09-24', name: 'İnkılap Tarihi İzleme', startTime: '09:20', endTime: '10:00' },
  { date: '2026-09-26', name: 'TMFSDİ İzleme Değerlendirmesi', startTime: '09:00', endTime: '11:50' },
  { date: '2026-09-28', name: 'Din Kültürü İzleme', startTime: '09:20', endTime: '10:00' },
  { date: '2026-10-01', name: 'İngilizce İzleme', startTime: '09:20', endTime: '10:00' },
  { date: '2026-10-05', name: 'TMFSDİ İzleme Değerlendirmesi', startTime: '09:20', endTime: '12:10' },
  { date: '2026-10-08', name: 'Türkçe İzleme', startTime: '09:20', endTime: '10:00' },
]

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const schools = (
      await pool.request().query("SELECT id, name FROM dbo.Schools WHERE name LIKE '%Bilfen%' ORDER BY name;")
    ).recordset

    console.log(`Bilfen okulu: ${schools.length}`)
    console.log(`Sınav/izleme kaydı: ${EXAMS.length} (okul başına)\n`)

    let writes = 0

    for (const school of schools) {
      const existing = (
        await pool
          .request()
          .input('sid', sql.UniqueIdentifier, school.id)
          .query(`
            SELECT CONVERT(char(10), start_date, 23) d, name
            FROM dbo.SchoolCalendarEntries WHERE school_id = @sid AND entry_type = 'sinav';
          `)
      ).recordset

      for (const exam of EXAMS) {
        const dup = existing.some((x) => x.d === exam.date && x.name === exam.name)
        if (dup) continue
        writes++
        if (COMMIT) {
          await pool
            .request()
            .input('sid', sql.UniqueIdentifier, school.id)
            .input('d', sql.Date, exam.date)
            .input('start', sql.NVarChar(5), exam.startTime)
            .input('end', sql.NVarChar(5), exam.endTime)
            .input('name', sql.NVarChar(200), exam.name)
            .query(`
              INSERT INTO dbo.SchoolCalendarEntries (school_id, entry_type, start_date, end_date, start_time, end_time, name)
              VALUES (@sid, 'sinav', @d, @d, @start, @end, @name);
            `)
        }
      }
    }

    console.log(`Yazılacak/yazılan sınav kaydı: ${writes}`)
    if (!COMMIT) {
      console.log('\nDRY-RUN. Yazmak için: node api/scripts/seed-bilfen-exam-calendar-eylul-ekim-2026.js --commit')
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
