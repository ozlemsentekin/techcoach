const { sql, withRequest } = require('./db')
const { json, clearSessionHeaders } = require('./http')
const { requireStudentContext } = require('./studentScope')
const { isSessionError } = require('./security')

async function studentGoalsHandler(request) {
  try {
    const context = await requireStudentContext(request)
    if (context.error) return context.error
    const db = await withRequest({ studentId: { type: sql.UniqueIdentifier, value: context.studentId } })
    const user = await db.query('SELECT full_name FROM dbo.Users WHERE id = @studentId')
    const isAylin = user.recordset[0]?.full_name?.trim().toLocaleLowerCase('tr-TR') === 'aylin şişman'
    if (request.method === 'PUT') {
      const payload = await request.json().catch(() => null)
      const goals = payload?.goals
      if (!goals || Array.isArray(goals) || typeof goals !== 'object' || Object.keys(goals).some((key) => !['private', 'public'].includes(key))) {
        return json(400, { error: 'Bir özel lise ve bir devlet lisesi hedefi girebilirsiniz.' })
      }
      const normalized = {}
      for (const kind of ['private', 'public']) {
        const goal = goals[kind]
        if (goal == null) { normalized[kind] = null; continue }
        if (typeof goal.name !== 'string' || !goal.name.trim() || goal.name.trim().length > 150 ||
          (goal.score != null && (typeof goal.score !== 'number' || !Number.isFinite(goal.score) || goal.score < 0 || goal.score > 500)) ||
          (goal.year != null && (!Number.isInteger(goal.year) || goal.year < 2000 || goal.year > 2100))) {
          return json(400, { error: 'Lise adı, 0–500 arasında puan ve geçerli bir yıl girin.' })
        }
        normalized[kind] = { name: goal.name.trim(), score: goal.score ?? null, year: goal.year ?? null }
      }
      db.input('goals', sql.NVarChar(sql.MAX), JSON.stringify(normalized))
      await db.query(`MERGE dbo.StudentHighSchoolGoals WITH (HOLDLOCK) AS t
        USING (SELECT @studentId AS student_id) AS s ON t.student_id = s.student_id
        WHEN MATCHED THEN UPDATE SET goals_json = @goals, updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (student_id, goals_json) VALUES (@studentId, @goals);`)
      return json(200, { goals: normalized, showStudyTime: isAylin })
    }
    const result = await db.query('SELECT goals_json FROM dbo.StudentHighSchoolGoals WHERE student_id = @studentId')
    const goals = result.recordset[0] ? JSON.parse(result.recordset[0].goals_json) : isAylin ? {
      private: { name: 'Robert Koleji', score: 481.1675, year: 2026 },
      public: { name: 'Kabataş Erkek Lisesi', score: 497.4323, year: 2026 },
    } : { private: null, public: null }
    return json(200, { goals, showStudyTime: isAylin })
  } catch (error) {
    if (isSessionError(error)) return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    console.error('studentGoalsHandler failed', error)
    return json(500, { error: 'Lise hedefleri yüklenemedi veya kaydedilemedi.' })
  }
}
module.exports = { studentGoalsHandler }
