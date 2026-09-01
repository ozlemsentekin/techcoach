// Geçici teşhis/düzeltme: bir görevi haftalık planda kimin eklediğini gösterir.
// Etiket önceliği: created_by_user_id → Users.full_name; yoksa rol bazlı (öğretmen dersi /
// öğrencinin velisi / öğrencinin kendi adı).
//
// Usage:
//   node api/scripts/inspect-task-creator.js --student "Aylin"
//   node api/scripts/inspect-task-creator.js --task <taskId>
//   node api/scripts/inspect-task-creator.js --fix <taskId> --user <userId> [--role ogretmen] [--teacher <studentTeacherId>]
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
function arg(name) {
  const i = process.argv.indexOf(name)
  return i === -1 ? null : process.argv[i + 1]
}

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    if (arg('--fix')) {
      const r = await pool
        .request()
        .input('id', sql.UniqueIdentifier, arg('--fix'))
        .input('uid', sql.UniqueIdentifier, arg('--user') || null)
        .input('role', sql.NVarChar(20), arg('--role') || null)
        .input('st', sql.UniqueIdentifier, arg('--teacher') || null)
        .query(`
          UPDATE dbo.Tasks
          SET created_by_user_id = COALESCE(@uid, created_by_user_id),
              created_by = COALESCE(@role, created_by),
              student_teacher_id = COALESCE(@st, student_teacher_id)
          OUTPUT deleted.created_by AS old_created_by, deleted.created_by_user_id AS old_uid,
                 inserted.created_by AS new_created_by, inserted.created_by_user_id AS new_uid,
                 inserted.student_teacher_id
          WHERE id = @id;`)
      console.log('FIX:', JSON.stringify(r.recordset, null, 2))
      return
    }

    const taskId = arg('--task')
    if (taskId) {
      const t = await pool.request().input('id', sql.UniqueIdentifier, taskId).query(`
        SELECT t.id, t.student_id, t.title, t.task_type, t.subject, t.date, t.created_by,
               t.created_by_user_id, cbu.full_name AS created_by_name,
               t.student_teacher_id, st.teacher_full_name AS linked_teacher_name,
               t.homework_id, t.resource_book_id, t.created_at, t.updated_at
        FROM dbo.Tasks t
        LEFT JOIN dbo.Users cbu ON cbu.id = t.created_by_user_id
        LEFT JOIN dbo.StudentTeachers st ON st.id = t.student_teacher_id
        WHERE t.id = @id;`)
      console.log('TASK:', JSON.stringify(t.recordset, null, 2))

      const logs = await pool.request().input('id', sql.UniqueIdentifier, taskId).query(`
        SELECT action, actor_role, actor_user_id, created_at
        FROM dbo.TaskActivityLogs WHERE task_id = @id ORDER BY created_at;`)
      console.log('ACTIVITY LOGS:', JSON.stringify(logs.recordset, null, 2))

      const row = t.recordset[0]
      if (row?.resource_book_id && row?.student_id) {
        const linked = await pool
          .request()
          .input('rb', sql.UniqueIdentifier, row.resource_book_id)
          .input('sid', sql.UniqueIdentifier, row.student_id)
          .query(`
            SELECT st.id AS student_teacher_id, st.teacher_full_name, st.teacher_user_id, st.is_active
            FROM dbo.StudentTeacherResourceBooks strb
            JOIN dbo.StudentTeachers st ON st.id = strb.teacher_id
            WHERE strb.resource_book_id = @rb AND st.student_id = @sid;`)
        console.log('BU KAYNAGI TAKIP EDEN OGRETMEN(LER):', JSON.stringify(linked.recordset, null, 2))
      }
    }

    const studentName = arg('--student')
    if (studentName) {
      const s = await pool.request().input('n', sql.NVarChar(120), `${studentName}%`).query(`
        SELECT u.id, u.full_name, p.full_name AS parent_name
        FROM dbo.Users u LEFT JOIN dbo.Users p ON p.id = u.parent_id
        WHERE u.role = 'ogrenci' AND u.full_name LIKE @n;`)
      for (const stu of s.recordset) {
        console.log(`\n=== ${stu.full_name} (veli: ${stu.parent_name || '-'}) ===`)
        const rows = await pool.request().input('sid', sql.UniqueIdentifier, stu.id).query(`
          SELECT t.id, t.title, t.subject, t.date, t.task_type, t.created_by,
                 t.created_by_user_id, cbu.full_name AS created_by_name,
                 t.student_teacher_id, t.created_at,
                 (SELECT TOP 1 st.teacher_full_name
                    FROM dbo.StudentTeacherResourceBooks strb
                    JOIN dbo.StudentTeachers st ON st.id = strb.teacher_id
                    WHERE strb.resource_book_id = t.resource_book_id AND st.student_id = t.student_id
                 ) AS resource_teacher
          FROM dbo.Tasks t
          LEFT JOIN dbo.Users cbu ON cbu.id = t.created_by_user_id
          WHERE t.student_id = @sid
          ORDER BY t.created_at DESC;`)
        console.log(JSON.stringify(rows.recordset, null, 2))
      }
    }
  } finally {
    await pool.close()
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
