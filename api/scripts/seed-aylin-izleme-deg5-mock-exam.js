// One-off: Aylin Şişman için "İZLEME DEĞ. 5" (31.10.2026) Genel Deneme sonucunu ekler.
// Sınav kurumu raporundaki (ekran görüntüleri) puan/şube-okul-genel sıra + sınıf/okul/Türkiye
// ortalaması + sınav geneli şube/okul/genel sıra verileri kaynaktır. Varsayılan: dry-run (INSERT edilecek veriyi basar, yazmaz).
// Apply etmek için: node api/scripts/seed-aylin-izleme-deg5-mock-exam.js --apply
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
const EXAM_DATE = '2026-10-31'
const TITLE = 'İZLEME DEĞ. 5'
// Üst özet satırı: Puan 80.44, Şube 12/19, Okul 65/87, Genel 1304/1988
const OVERALL = {
  branchRank: 12,
  branchRankTotal: 19,
  schoolRank: 65,
  schoolRankTotal: 87,
  turkeyRank: 1304,
  turkeyRankTotal: 1988,
}
const CLASS_LABEL = '8D'
const SCHOOL_LABEL = 'BİLFEN ESENŞEHİR İLKÖĞRETİM KURUMU'

// GENEL_DENEME_TEMPLATE sırasıyla (api/src/mockExams.js)
const SUBJECTS = [
  { name: 'Türkçe', total: 20, correct: 17, wrong: 3, blank: 0, score: 80.0, branchRank: 8, schoolRank: 41, overallRank: 971, classAvgScore: 79.38, schoolAvgScore: 81.69, turkeyAvgScore: 80.19 },
  { name: 'Matematik', total: 20, correct: 18, wrong: 2, blank: 0, score: 86.67, branchRank: 12, schoolRank: 48, overallRank: 989, classAvgScore: 83.33, schoolAvgScore: 83.6, turkeyAvgScore: 80.8 },
  { name: 'Fen Bilimleri', total: 20, correct: 15, wrong: 5, blank: 0, score: 66.67, branchRank: 14, schoolRank: 69, overallRank: 1479, classAvgScore: 76.14, schoolAvgScore: 79.67, turkeyAvgScore: 78.01 },
  { name: 'T.C. İnkılap Tarihi ve Atatürkçülük', total: 10, correct: 9, wrong: 1, blank: 0, score: 86.67, branchRank: 10, schoolRank: 54, overallRank: 1153, classAvgScore: 86.67, schoolAvgScore: 92.18, turkeyAvgScore: 91.22 },
  { name: 'Din Kültürü ve Ahlak Bilgisi', total: 10, correct: 9, wrong: 1, blank: 0, score: 86.67, branchRank: 9, schoolRank: 45, overallRank: 962, classAvgScore: 87.54, schoolAvgScore: 91.19, turkeyAvgScore: 88.71 },
  { name: 'İngilizce', total: 10, correct: 10, wrong: 0, blank: 0, score: 100.0, branchRank: 1, schoolRank: 1, overallRank: 1, classAvgScore: 95.09, schoolAvgScore: 95.86, turkeyAvgScore: 93.55 },
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
    console.log(
      `  Genel sıra: şube ${OVERALL.branchRank}/${OVERALL.branchRankTotal}, okul ${OVERALL.schoolRank}/${OVERALL.schoolRankTotal}, Türkiye ${OVERALL.turkeyRank}/${OVERALL.turkeyRankTotal}`,
    )
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
