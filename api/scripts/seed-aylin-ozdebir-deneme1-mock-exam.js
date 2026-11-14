// One-off: Aylin Şişman için "Özdebir Deneme 1" (23.10.2026) Genel Deneme sonucunu ekler.
// Kaynak: "TÜRKİYE GENELİ DENEME-1 (O8126)" sınav sonuç belgesi (Özdebir Deneme 1.pdf,
// İstanbul/Kadıköy/Ada Eğitim). Belgede ders puanı/sınıf ortalaması yok; puan = net/soru*100,
// okul ort. = "Kurum net ort." /soru*100, Türkiye ort. = "Sınav net ort." /soru*100. Ders bazlı sıra yok.
// Sıralama: şube 202/398, okul 216/427, Türkiye 12592/121492 (il 3303/23771, ilçe 331/1262 saklanmıyor).
// "Sosyal Bilgiler" = T.C. İnkılap Tarihi ve Atatürkçülük. Varsayılan: dry-run.
// Apply etmek için: node api/scripts/seed-aylin-ozdebir-deneme1-mock-exam.js --apply
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
const EXAM_DATE = '2026-10-23'
const TITLE = 'ADA SINAV Özdebir Deneme 1'
// Puan 456,131 (LGS puanı; saklanmıyor)
const OVERALL = {
  branchRank: 202,
  branchRankTotal: 398,
  schoolRank: 216,
  schoolRankTotal: 427,
  turkeyRank: 12592,
  turkeyRankTotal: 121492,
}
const CLASS_LABEL = null
const SCHOOL_LABEL = 'ADA EĞİTİM (KADIKÖY)'

// GENEL_DENEME_TEMPLATE sırasıyla (api/src/mockExams.js)
const SUBJECTS = [
  { name: 'Türkçe', total: 20, correct: 16, wrong: 4, blank: 0, score: 73.33, branchRank: null, schoolRank: null, overallRank: null, classAvgScore: null, schoolAvgScore: 79.2, turkeyAvgScore: 61.3 },
  { name: 'Matematik', total: 20, correct: 18, wrong: 2, blank: 0, score: 86.67, branchRank: null, schoolRank: null, overallRank: null, classAvgScore: null, schoolAvgScore: 71.65, turkeyAvgScore: 41.05 },
  { name: 'Fen Bilimleri', total: 20, correct: 18, wrong: 2, blank: 0, score: 86.67, branchRank: null, schoolRank: null, overallRank: null, classAvgScore: null, schoolAvgScore: 85.9, turkeyAvgScore: 69.1 },
  { name: 'T.C. İnkılap Tarihi ve Atatürkçülük', total: 10, correct: 10, wrong: 0, blank: 0, score: 100.0, branchRank: null, schoolRank: null, overallRank: null, classAvgScore: null, schoolAvgScore: 80.9, turkeyAvgScore: 60.3 },
  { name: 'Din Kültürü ve Ahlak Bilgisi', total: 10, correct: 10, wrong: 0, blank: 0, score: 100.0, branchRank: null, schoolRank: null, overallRank: null, classAvgScore: null, schoolAvgScore: 79.8, turkeyAvgScore: 64.4 },
  { name: 'İngilizce', total: 10, correct: 10, wrong: 0, blank: 0, score: 100.0, branchRank: null, schoolRank: null, overallRank: null, classAvgScore: null, schoolAvgScore: 87.2, turkeyAvgScore: 52.7 },
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
