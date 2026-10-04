// One-off: Aylin Şişman için "İZLEME DEĞ. 2" (26.09.2026) Genel Deneme sonucunu ekler.
// Sınav kurumu raporundaki (ekran görüntüleri) puan/şube-okul-genel sıra + sınıf/okul/Türkiye
// ortalaması verileri kaynaktır. Varsayılan: dry-run (INSERT edilecek veriyi basar, yazmaz).
// Apply etmek için: node api/scripts/seed-aylin-izleme-deg2-mock-exam.js --apply
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

const STUDENT_ID = '427246B1-A97D-4611-B393-D5F6C1AB6915'
const EXAM_DATE = '2026-09-26'
const TITLE = 'İZLEME DEĞ. 2'
const CLASS_LABEL = '8D'
const SCHOOL_LABEL = 'BİLFEN ESENŞEHİR İLKÖĞRETİM KURUMU'

// GENEL_DENEME_TEMPLATE sırasıyla (api/src/mockExams.js)
const SUBJECTS = [
  {
    name: 'Türkçe',
    total: 20,
    correct: 17,
    wrong: 3,
    blank: 0,
    score: 80.0,
    branchRank: 7,
    schoolRank: 45,
    overallRank: 915,
    classAvgScore: 74.24,
    schoolAvgScore: 80.3,
    turkeyAvgScore: 78.6,
  },
  {
    name: 'Matematik',
    total: 20,
    correct: 19,
    wrong: 1,
    blank: 0,
    score: 93.33,
    branchRank: 3,
    schoolRank: 14,
    overallRank: 349,
    classAvgScore: 77.95,
    schoolAvgScore: 80.61,
    turkeyAvgScore: 75.92,
  },
  {
    name: 'Fen Bilimleri',
    total: 20,
    correct: 16,
    wrong: 4,
    blank: 0,
    score: 73.33,
    branchRank: 4,
    schoolRank: 29,
    overallRank: 669,
    classAvgScore: 54.24,
    schoolAvgScore: 61.54,
    turkeyAvgScore: 61.24,
  },
  {
    name: 'T.C. İnkılap Tarihi ve Atatürkçülük',
    total: 10,
    correct: 10,
    wrong: 0,
    blank: 0,
    score: 100.0,
    branchRank: 1,
    schoolRank: 1,
    overallRank: 1,
    classAvgScore: 93.94,
    schoolAvgScore: 95.41,
    turkeyAvgScore: 94.18,
  },
  {
    name: 'Din Kültürü ve Ahlak Bilgisi',
    total: 10,
    correct: 10,
    wrong: 0,
    blank: 0,
    score: 100.0,
    branchRank: 1,
    schoolRank: 1,
    overallRank: 1,
    classAvgScore: 76.06,
    schoolAvgScore: 80.93,
    turkeyAvgScore: 76.2,
  },
  {
    name: 'İngilizce',
    total: 10,
    correct: 10,
    wrong: 0,
    blank: 0,
    score: 100.0,
    branchRank: 1,
    schoolRank: 1,
    overallRank: 1,
    classAvgScore: 96.36,
    schoolAvgScore: 96.45,
    turkeyAvgScore: 94.06,
  },
]

async function main() {
  const apply = process.argv.includes('--apply')
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(connectionString)
  try {
    const existing = await pool
      .request()
      .input('studentId', sql.UniqueIdentifier, STUDENT_ID)
      .input('examDate', sql.Date, EXAM_DATE)
      .query(`
        SELECT id FROM dbo.MockExams
        WHERE student_id = @studentId AND kind = N'genel' AND exam_date = @examDate;
      `)
    if (existing.recordset.length > 0) {
      console.log(`Bu tarihte zaten bir Genel Deneme kaydı var: id=${existing.recordset[0].id}. Çıkılıyor.`)
      return
    }

    console.log(`Eklenecek: "${TITLE}" (${EXAM_DATE}), ${SUBJECTS.length} ders satırı.`)
    SUBJECTS.forEach((s) =>
      console.log(`  - ${s.name}: D${s.correct}/Y${s.wrong}/B${s.blank} puan=${s.score} genel_sira=${s.overallRank}`),
    )

    if (!apply) {
      console.log('\nDry-run: hiçbir şey yazılmadı. Uygulamak için --apply ekleyin.')
      return
    }

    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    try {
      const examResult = await transaction
        .request()
        .input('studentId', sql.UniqueIdentifier, STUDENT_ID)
        .input('kind', sql.NVarChar(20), 'genel')
        .input('examDate', sql.Date, EXAM_DATE)
        .input('title', sql.NVarChar(200), TITLE)
        .input('classLabel', sql.NVarChar(50), CLASS_LABEL)
        .input('schoolLabel', sql.NVarChar(200), SCHOOL_LABEL).query(`
          INSERT INTO dbo.MockExams (student_id, kind, exam_date, title, class_label, school_label)
          OUTPUT inserted.id
          VALUES (@studentId, @kind, @examDate, @title, @classLabel, @schoolLabel);
        `)
      const examId = examResult.recordset[0].id
      console.log(`MockExams kaydı oluşturuldu: id=${examId}`)

      for (const s of SUBJECTS) {
        await transaction
          .request()
          .input('examId', sql.UniqueIdentifier, examId)
          .input('subjectName', sql.NVarChar(100), s.name)
          .input('totalQuestions', sql.Int, s.total)
          .input('correctCount', sql.Int, s.correct)
          .input('wrongCount', sql.Int, s.wrong)
          .input('blankCount', sql.Int, s.blank)
          .input('score', sql.Decimal(6, 2), s.score)
          .input('branchRank', sql.Int, s.branchRank)
          .input('schoolRank', sql.Int, s.schoolRank)
          .input('overallRank', sql.Int, s.overallRank)
          .input('classAvgScore', sql.Decimal(6, 2), s.classAvgScore)
          .input('schoolAvgScore', sql.Decimal(6, 2), s.schoolAvgScore)
          .input('turkeyAvgScore', sql.Decimal(6, 2), s.turkeyAvgScore).query(`
            INSERT INTO dbo.MockExamSubjects
              (mock_exam_id, subject_name, total_questions, correct_count, wrong_count, blank_count,
               score, branch_rank, school_rank, overall_rank, class_avg_score, school_avg_score, turkey_avg_score)
            VALUES
              (@examId, @subjectName, @totalQuestions, @correctCount, @wrongCount, @blankCount,
               @score, @branchRank, @schoolRank, @overallRank, @classAvgScore, @schoolAvgScore, @turkeyAvgScore);
          `)
      }

      await transaction.commit()
      console.log(`\nUygulandı: MockExams (${examId}) + ${SUBJECTS.length} MockExamSubjects satırı eklendi.`)
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
