// One-off: denemeden Hata Defteri'ne düşen WrongQuestions kayıtlarında LGS adıyla
// ("T.C. İnkılap Tarihi ve Atatürkçülük") yazılmış ders adını panel ders adına
// (dbo.Subjects) çevirir. Yeni kayıtlar mockExams.js wrongQuestionSubjectName ile zaten
// doğru adla yazılıyor. Idempotent. Varsayılan: dry-run.
// Apply etmek için: node api/scripts/fix-mock-exam-wrong-question-subject-names.js --apply
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

const FROM_NAME = 'T.C. İnkılap Tarihi ve Atatürkçülük'
const TO_NAME = 'İnkılap Tarihi ve Atatürkçülük'

async function main() {
  const apply = process.argv.includes('--apply')
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(connectionString)
  try {
    const subject = await pool
      .request()
      .input('toName', sql.NVarChar(100), TO_NAME)
      .query('SELECT id FROM dbo.Subjects WHERE name = @toName;')
    if (!subject.recordset.length) throw new Error(`dbo.Subjects'te "${TO_NAME}" yok.`)

    const rows = await pool
      .request()
      .input('fromName', sql.NVarChar(100), FROM_NAME)
      .query(`
        SELECT id, student_id, topic, created_at FROM dbo.WrongQuestions
        WHERE subject = @fromName AND mock_exam_subject_id IS NOT NULL;
      `)
    console.log(`Bulunan kayıt: ${rows.recordset.length}`)
    rows.recordset.forEach((row) => console.log(`  ${row.id}  ${row.topic}`))

    if (!apply) {
      console.log('Dry-run. Uygulamak için --apply.')
      return
    }

    const result = await pool
      .request()
      .input('fromName', sql.NVarChar(100), FROM_NAME)
      .input('toName', sql.NVarChar(100), TO_NAME)
      .query(`
        UPDATE dbo.WrongQuestions SET subject = @toName
        WHERE subject = @fromName AND mock_exam_subject_id IS NOT NULL;
      `)
    console.log(`Güncellenen kayıt: ${result.rowsAffected[0]}`)
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
