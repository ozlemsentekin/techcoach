// One-off: Aylin Şişman için "FEN İZLEME 1" (21.09.2026) Branş Deneme sonucunu ekler.
// Sınav kurumu raporundaki (ekran görüntüsü) puan/şube-okul-genel sıra + sınıf/okul/Türkiye
// ortalaması verileri kaynaktır. Varsayılan: dry-run (INSERT edilecek veriyi basar, yazmaz).
// Apply etmek için: node api/scripts/seed-aylin-fen-izleme1-mock-exam.js --apply
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
const EXAM_DATE = '2026-09-21'
const TITLE = 'FEN İZLEME 1'
const CLASS_LABEL = '8D'
const SCHOOL_LABEL = 'BİLFEN ESENŞEHİR İLKÖĞRETİM KURUMU'
// Üst özet satırı: Şube 4/23, Okul 15/93, Genel 540/2103
const OVERALL = {
  branchRank: 4,
  branchRankTotal: 23,
  schoolRank: 15,
  schoolRankTotal: 93,
  turkeyRank: 540,
  turkeyRankTotal: 2103,
}

const SUBJECT = {
  name: 'Fen Bilimleri',
  total: 20,
  correct: 17,
  wrong: 3,
  blank: 0,
  score: 80.0,
  branchRank: 4,
  schoolRank: 15,
  overallRank: 540,
  classAvgScore: 65.15,
  schoolAvgScore: 69.21,
  turkeyAvgScore: 68.67,
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
      .input('examDate', sql.Date, EXAM_DATE)
      .input('title', sql.NVarChar(200), TITLE)
      .query(`
        SELECT id FROM dbo.MockExams
        WHERE student_id = @studentId AND kind = N'brans' AND (exam_date = @examDate OR title = @title);
      `)
    if (existing.recordset.length > 0) {
      console.log(`Bu sınav için zaten bir Branş Deneme kaydı var: id=${existing.recordset[0].id}. Çıkılıyor.`)
      return
    }

    const subjectResult = await pool
      .request()
      .input('subjectName', sql.NVarChar(100), SUBJECT.name)
      .query(`SELECT id FROM dbo.Subjects WHERE name = @subjectName;`)
    if (subjectResult.recordset.length !== 1) throw new Error(`"${SUBJECT.name}" dersi tekil bulunamadı.`)
    const s = { ...SUBJECT, subjectId: subjectResult.recordset[0].id }
    console.log(`Eklenecek: "${TITLE}" (${EXAM_DATE})`)
    console.log(
      `  Genel sıra: şube ${OVERALL.branchRank}/${OVERALL.branchRankTotal}, okul ${OVERALL.schoolRank}/${OVERALL.schoolRankTotal}, Türkiye ${OVERALL.turkeyRank}/${OVERALL.turkeyRankTotal}`,
    )
    console.log(`  - ${s.name}: D${s.correct}/Y${s.wrong}/B${s.blank} puan=${s.score} genel_sira=${s.overallRank}`)

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
        .input('kind', sql.NVarChar(20), 'brans')
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
      console.log(`MockExams kaydı oluşturuldu: id=${examId}`)

      await transaction
        .request()
        .input('examId', sql.UniqueIdentifier, examId)
        .input('subjectId', sql.UniqueIdentifier, s.subjectId)
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
