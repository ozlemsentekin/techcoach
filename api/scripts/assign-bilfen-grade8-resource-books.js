// Assign the three requested books to current and future Bilfen grade-8 students.
// node api/scripts/assign-bilfen-grade8-resource-books.js          # preview
// node api/scripts/assign-bilfen-grade8-resource-books.js --commit # install + backfill
// Stable IDs intentionally exclude the other Bilfen books (including private ones).
const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const BOOKS = [
  ['6574B1BA-93EE-4E0F-8E58-A73D9B5CD955', 'Biltest Fen Bilimleri Soru Bankası 8. Sınıf'],
  ['20F36DF8-25F8-4977-8724-A1A41D8AA8B0', 'Biltest Türkçe Soru Bankası 8. Sınıf'],
  ['D1E9911B-EFE8-45FA-B292-6C02E034F576', 'Pro & Test Soru Bankası - Fen Bilimleri 8. Sınıf'],
]
const bookIds = BOOKS.map(([id]) => `'${id}'`).join(', ')

function eligiblePairs(profileSource) {
  return `
    SELECT sp.student_id, rb.id AS resource_book_id
    FROM ${profileSource} sp
    JOIN dbo.Schools s ON s.id = sp.school_id
    JOIN dbo.Users u ON u.id = sp.student_id AND u.role = N'ogrenci'
    CROSS JOIN dbo.ResourceBooks rb
    WHERE sp.grade = N'8'
      AND s.name COLLATE Turkish_100_CI_AI LIKE N'%bilfen%'
      AND rb.id IN (${bookIds}) AND rb.is_active = 1
  `
}

function insertMissing(profileSource) {
  return `
    INSERT INTO dbo.StudentResourceBooks (student_id, resource_book_id)
    SELECT eligible.student_id, eligible.resource_book_id
    FROM (${eligiblePairs(profileSource)}) eligible
    WHERE NOT EXISTS (
      SELECT 1 FROM dbo.StudentResourceBooks assigned WITH (UPDLOCK, HOLDLOCK)
      WHERE assigned.student_id = eligible.student_id
        AND assigned.resource_book_id = eligible.resource_book_id
    );
  `
}

async function main() {
  const settingsPath = path.join(__dirname, '..', 'local.settings.json')
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    for (const [key, value] of Object.entries(settings.Values || {})) {
      if (!process.env[key] && typeof value === 'string') process.env[key] = value
    }
  }
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const books = (await pool.request().query(`
      SELECT rb.id, rb.name, rb.grade, rb.is_active, rb.scope, rb.status, p.name AS publisher
      FROM dbo.ResourceBooks rb JOIN dbo.Publishers p ON p.id = rb.publisher_id
      WHERE rb.id IN (${bookIds});
    `)).recordset
    for (const [id, name] of BOOKS) {
      const book = books.find((row) => row.id.toUpperCase() === id)
      if (!book || book.name !== name || book.grade !== '8' || !book.is_active
        || book.scope !== 'catalog' || book.status !== 'approved' || book.publisher !== 'Bilfen Yayınları') {
        throw new Error(`Kaynak doğrulanamadı: ${name}`)
      }
    }

    const summaryQuery = `
      SELECT COUNT(DISTINCT e.student_id) AS students, COUNT(*) AS expected_assignments,
        COUNT(a.id) AS existing_assignments, COUNT(*) - COUNT(a.id) AS missing_assignments
      FROM (${eligiblePairs('dbo.StudentProfiles')}) e
      LEFT JOIN dbo.StudentResourceBooks a
        ON a.student_id = e.student_id AND a.resource_book_id = e.resource_book_id;
    `
    console.log('Önce:', (await pool.request().query(summaryQuery)).recordset[0])
    if (!process.argv.includes('--commit')) return

    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    try {
      // INSERT covers registration; school/grade UPDATE covers transfers and promotion.
      // Ignore the existing updated_at trigger's nested UPDATE.
      await new sql.Request(transaction).query(`
        CREATE OR ALTER TRIGGER dbo.TR_StudentProfiles_AssignBilfenGrade8Books
        ON dbo.StudentProfiles AFTER INSERT, UPDATE AS
        BEGIN
          SET NOCOUNT ON;
          IF NOT (UPDATE(school_id) OR UPDATE(grade)) RETURN;
          ${insertMissing('inserted')}
        END;
      `)
      await new sql.Request(transaction).query(insertMissing('dbo.StudentProfiles'))
      const after = (await new sql.Request(transaction).query(summaryQuery)).recordset[0]
      if (after.missing_assignments !== 0) throw new Error('Eksik atamalar var; işlem geri alınıyor.')
      await transaction.commit()
      console.log('Tamamlandı:', after)
    } catch (error) {
      await transaction.rollback().catch(() => {})
      throw error
    }
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
