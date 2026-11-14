// One-off: Aylin Şişman için "FEN BİLİMLERİ İZLEME 2" (15.10.2026) Branş Deneme sonucunu ekler.
// Sınav kurumu raporundaki (ekran görüntüleri) puan/şube-okul-genel sıra + sınıf/okul/Türkiye
// ortalaması verileri kaynaktır. Varsayılan: dry-run (INSERT edilecek veriyi basar, yazmaz).
// Apply etmek için: node api/scripts/seed-aylin-fen-izleme2-mock-exam.js --apply
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
const KIND = 'brans'
const EXAM_DATE = '2026-10-15'
const TITLE = 'FEN BİLİMLERİ İZLEME 2'
// Üst özet satırı: Puan 66.67, Şube 15/23, Okul 70/93, Genel 1526/2106
const OVERALL = {
  branchRank: 15,
  branchRankTotal: 23,
  schoolRank: 70,
  schoolRankTotal: 93,
  turkeyRank: 1526,
  turkeyRankTotal: 2106,
}
const CLASS_LABEL = '8D'
const SCHOOL_LABEL = 'BİLFEN ESENŞEHİR İLKÖĞRETİM KURUMU'

const SUBJECT = {
  id: '9E09BEB3-C5A7-4FFF-8E9D-6C8A8C9C3572',
  name: 'Fen Bilimleri',
  total: 20,
  correct: 15,
  wrong: 5,
  blank: 0,
  score: 66.67,
  branchRank: 15,
  schoolRank: 70,
  overallRank: 1526,
  classAvgScore: 75.15,
  schoolAvgScore: 79.25,
  turkeyAvgScore: 76.12,
}

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
      .input('kind', sql.NVarChar(20), KIND)
      .input('title', sql.NVarChar(200), TITLE)
      .query(`
        SELECT id FROM dbo.MockExams
        WHERE student_id = @studentId AND kind = @kind AND title = @title;
      `)
    if (existing.recordset.length > 0) {
      console.log(`Bu başlıkla zaten bir Branş Deneme kaydı var: id=${existing.recordset[0].id}. Çıkılıyor.`)
      return
    }

    const s = SUBJECT
    console.log(`Eklenecek: "${TITLE}" (${EXAM_DATE}), kind=${KIND}`)
    console.log(
      `  Genel sıra: şube ${OVERALL.branchRank}/${OVERALL.branchRankTotal}, okul ${OVERALL.schoolRank}/${OVERALL.schoolRankTotal}, Türkiye ${OVERALL.turkeyRank}/${OVERALL.turkeyRankTotal}`,
    )
    console.log(`  - ${s.name}: D${s.correct}/Y${s.wrong}/B${s.blank} puan=${s.score} ort=${s.classAvgScore}/${s.schoolAvgScore}/${s.turkeyAvgScore}`)

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
        .input('kind', sql.NVarChar(20), KIND)
        .input('examDate', sql.Date, EXAM_DATE)
        .input('title', sql.NVarChar(200), TITLE)
        .input('classLabel', sql.NVarChar(50), CLASS_LABEL)
        .input('schoolLabel', sql.NVarChar(200), SCHOOL_LABEL)
        .input('branchRank', sql.Int, OVERALL.branchRank)
        .input('branchRankTotal', sql.Int, OVERALL.branchRankTotal)
        .input('schoolRank', sql.Int, OVERALL.schoolRank)
        .input('schoolRankTotal', sql.Int, OVERALL.schoolRankTotal)
        .input('turkeyRank', sql.Int, OVERALL.turkeyRank)
        .input('turkeyRankTotal', sql.Int, OVERALL.turkeyRankTotal).query(`
          INSERT INTO dbo.MockExams
            (student_id, kind, exam_date, title, class_label, school_label,
             overall_branch_rank, overall_branch_rank_total, overall_school_rank, overall_school_rank_total,
             overall_turkey_rank, overall_turkey_rank_total)
          OUTPUT inserted.id
          VALUES
            (@studentId, @kind, @examDate, @title, @classLabel, @schoolLabel,
             @branchRank, @branchRankTotal, @schoolRank, @schoolRankTotal,
             @turkeyRank, @turkeyRankTotal);
        `)
      const examId = examResult.recordset[0].id

      await transaction
        .request()
        .input('examId', sql.UniqueIdentifier, examId)
        .input('subjectId', sql.UniqueIdentifier, s.id)
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
            (mock_exam_id, subject_id, subject_name, total_questions, correct_count, wrong_count, blank_count,
             score, branch_rank, school_rank, overall_rank, class_avg_score, school_avg_score, turkey_avg_score)
          VALUES
            (@examId, @subjectId, @subjectName, @totalQuestions, @correctCount, @wrongCount, @blankCount,
             @score, @branchRank, @schoolRank, @overallRank, @classAvgScore, @schoolAvgScore, @turkeyAvgScore);
        `)

      await transaction.commit()
      console.log(`\nUygulandı: MockExams (${examId}) + 1 MockExamSubjects satırı eklendi.`)
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
