// Geçici teşhis: "Genel Analiz > Günlük Soru Aktivitesi" grafiğinde Aylin için
// 19 Ağustos öncesi neden veri görünüyor? Erken tarihli session/task/homework
// satırlarını ve hangi tarih alanının kullanıldığını listeler.
//
// Usage: node api/scripts/inspect-aylin-early-activity.js [--name "Aylin"] [--before 2026-08-19]
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
function arg(name, fallback = null) {
  const i = process.argv.indexOf(name)
  return i === -1 ? fallback : process.argv[i + 1]
}

async function main() {
  loadLocalSettings()
  const name = arg('--name', 'Aylin')
  const before = arg('--before', '2026-08-19')
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const students = (
      await pool.request().input('n', sql.NVarChar(200), `%${name}%`).query(`
        SELECT id, full_name, created_at FROM dbo.Users WHERE role = 'ogrenci' AND full_name LIKE @n;
      `)
    ).recordset
    console.log('Eşleşen öğrenciler:', students)
    if (!students.length) return
    const studentId = students[0].id
    console.log(`\n>>> ${students[0].full_name} (${studentId}), hesap oluşturma: ${students[0].created_at}`)
    console.log(`>>> "${before}" öncesi aktivite:\n`)

    const req = () => pool.request().input('sid', sql.UniqueIdentifier, studentId).input('before', sql.NVarChar(10), before)

    const sessions = (
      await req().query(`
        SELECT ss.id, ss.started_at, ss.ended_at, ss.created_at, ss.completed_question_count,
               ss.correct_count, ss.wrong_count, ss.task_id, t.date AS task_date, t.title, t.task_type
        FROM dbo.StudySessions ss
        LEFT JOIN dbo.Tasks t ON t.id = ss.task_id
        WHERE ss.student_id = @sid AND CONVERT(varchar(10), ss.started_at, 126) < @before
        ORDER BY ss.started_at;
      `)
    ).recordset
    console.log(`--- StudySessions (started_at < ${before}): ${sessions.length}`)
    sessions.forEach((s) => console.log('  ', JSON.stringify(s)))

    const tasks = (
      await req().query(`
        SELECT t.id, t.date, t.completed_at, t.created_at, t.updated_at, t.status, t.task_type, t.title,
               t.completed_question_count, t.correct_count, t.wrong_count,
               CASE WHEN t.test_results_json IS NULL THEN 0 ELSE 1 END AS has_test_results
        FROM dbo.Tasks t
        WHERE t.student_id = @sid AND t.is_draft = 0 AND t.is_unscheduled = 0
          AND (t.correct_count > 0 OR t.wrong_count > 0 OR t.completed_question_count > 0 OR t.test_results_json IS NOT NULL)
          AND COALESCE(CONVERT(varchar(10), t.completed_at, 126), CONVERT(varchar(10), t.date, 126)) < @before
        ORDER BY t.date;
      `)
    ).recordset
    console.log(`\n--- Tasks (kayıtlı iş var, completed_at||date < ${before}): ${tasks.length}`)
    tasks.forEach((t) => console.log('  ', JSON.stringify(t)))

    const homeworks = (
      await req().query(`
        SELECT t.id, t.date AS due_date, t.assigned_date, t.updated_at, t.created_at, t.status, t.task_type,
               t.completed_question_count, t.is_unscheduled
        FROM dbo.Tasks t
        WHERE t.student_id = @sid AND t.is_draft = 0
          AND t.task_type IN ('odev','soru-bankasi-odevi','okul-odevi','etkinlik-odevi')
          AND t.completed_question_count > 0
          AND COALESCE(CONVERT(varchar(10), t.updated_at, 126), CONVERT(varchar(10), t.date, 126), CONVERT(varchar(10), t.assigned_date, 126)) < @before
        ORDER BY t.updated_at;
      `)
    ).recordset
    console.log(`\n--- Homework-tipi Tasks (completed_question_count>0, updated_at||due||assigned < ${before}): ${homeworks.length}`)
    homeworks.forEach((h) => console.log('  ', JSON.stringify(h)))

    const manual = (
      await req().query(`
        SELECT smtc.test_id, smtc.marked_at, smtc.correct_count, smtc.wrong_count, smtc.blank_count
        FROM dbo.StudentManualTestCompletions smtc
        WHERE smtc.student_id = @sid AND CONVERT(varchar(10), smtc.marked_at, 126) < @before
        ORDER BY smtc.marked_at;
      `)
    ).recordset
    console.log(`\n--- ManualTestCompletions (marked_at < ${before}): ${manual.length}`)
    manual.forEach((m) => console.log('  ', JSON.stringify(m)))
  } finally {
    await pool.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
