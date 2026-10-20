// One-off: Aylin Şişman için 5 Branş Deneme (izleme) sonucunu ekler: DİN KÜLTÜRÜ İZLEME 1,
// İNGİLİZCE İZLEME 1, TÜRKÇE İZLEME 2, MATEMATİK İZLEME 2, T.C. İNKILAP İZLEME 2.
// Sınav kurumu raporlarındaki (ekran görüntüleri) puan/şube-okul-genel sıra + sınıf/okul/Türkiye
// ortalaması verileri kaynaktır.
// Her sınav ayrı transaction; aynı başlık/tarihli branş kaydı varsa atlanır.
// Varsayılan: dry-run. Apply etmek için: node api/scripts/seed-aylin-brans-izlemeler-ekim-2026.js --apply
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
const CLASS_LABEL = '8D'
const SCHOOL_LABEL = 'BİLFEN ESENŞEHİR İLKÖĞRETİM KURUMU'

// overall: [şube, şubeToplam, okul, okulToplam, genel, genelToplam]
// avg: [8D, okul, Tüm Okullar] veya null
const EXAMS = [
  {
    title: 'DİN KÜLTÜRÜ İZLEME 1',
    date: '2026-09-28',
    overall: [15, 23, 59, 92, 1235, 2096],
    subject: 'Din Kültürü ve Ahlak Bilgisi',
    dyb: [17, 3, 0],
    score: 80.0,
    avg: [82.32, 83.55, 83.17],
  },
  {
    title: 'İNGİLİZCE İZLEME 1',
    date: '2026-10-01',
    overall: [1, 23, 1, 93, 1, 2128],
    subject: 'İngilizce',
    dyb: [20, 0, 0],
    score: 100.0,
    avg: [95.94, 97.06, 97.44],
  },
  {
    title: 'TÜRKÇE İZLEME 2',
    date: '2026-10-08',
    overall: [1, 23, 1, 94, 1, 2148],
    subject: 'Türkçe',
    dyb: [20, 0, 0],
    score: 100.0,
    avg: [91.01, 92.34, 89.9],
  },
  {
    title: 'MATEMATİK İZLEME 2',
    date: '2026-10-12',
    overall: [6, 23, 25, 92, 527, 2125],
    subject: 'Matematik',
    dyb: [17, 3, 0],
    score: 80.0,
    avg: [64.57, 68.41, 65.62],
  },
  {
    title: 'T.C. İNKILAP İZLEME 2',
    date: '2026-10-19',
    overall: [10, 22, 58, 89, 1319, 2130],
    subject: 'İnkılap Tarihi ve Atatürkçülük',
    dyb: [17, 3, 0],
    score: 80.0,
    avg: [78.79, 85.64, 82.96],
  },
]

async function insertExam(pool, exam, subjectId) {
  const [br, brt, sr, srt, tr, trt] = exam.overall
  const [correct, wrong, blank] = exam.dyb
  const [classAvg, schoolAvg, turkeyAvg] = exam.avg || [null, null, null]
  const transaction = new sql.Transaction(pool)
  await transaction.begin()
  try {
    const examResult = await transaction
      .request()
      .input('studentId', sql.UniqueIdentifier, STUDENT_ID)
      .input('kind', sql.NVarChar(20), 'brans')
      .input('examDate', sql.Date, exam.date)
      .input('title', sql.NVarChar(200), exam.title)
      .input('classLabel', sql.NVarChar(50), CLASS_LABEL)
      .input('schoolLabel', sql.NVarChar(200), SCHOOL_LABEL)
      .input('branchRank', sql.Int, br)
      .input('branchRankTotal', sql.Int, brt)
      .input('schoolRank', sql.Int, sr)
      .input('schoolRankTotal', sql.Int, srt)
      .input('turkeyRank', sql.Int, tr)
      .input('turkeyRankTotal', sql.Int, trt).query(`
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
      .input('subjectId', sql.UniqueIdentifier, subjectId)
      .input('subjectName', sql.NVarChar(100), exam.subject)
      .input('totalQuestions', sql.Int, correct + wrong + blank)
      .input('correctCount', sql.Int, correct)
      .input('wrongCount', sql.Int, wrong)
      .input('blankCount', sql.Int, blank)
      .input('score', sql.Decimal(6, 2), exam.score)
      .input('branchRank', sql.Int, br)
      .input('schoolRank', sql.Int, sr)
      .input('overallRank', sql.Int, tr)
      .input('classAvgScore', sql.Decimal(6, 2), classAvg)
      .input('schoolAvgScore', sql.Decimal(6, 2), schoolAvg)
      .input('turkeyAvgScore', sql.Decimal(6, 2), turkeyAvg).query(`
        INSERT INTO dbo.MockExamSubjects
          (mock_exam_id, subject_id, subject_name, total_questions, correct_count, wrong_count, blank_count,
           score, branch_rank, school_rank, overall_rank, class_avg_score, school_avg_score, turkey_avg_score)
        VALUES
          (@examId, @subjectId, @subjectName, @totalQuestions, @correctCount, @wrongCount, @blankCount,
           @score, @branchRank, @schoolRank, @overallRank, @classAvgScore, @schoolAvgScore, @turkeyAvgScore);
      `)

    await transaction.commit()
    return examId
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

async function main() {
  const apply = process.argv.includes('--apply')
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(connectionString)
  try {
    for (const exam of EXAMS) {
      const existing = await pool
        .request()
        .input('studentId', sql.UniqueIdentifier, STUDENT_ID)
        .input('examDate', sql.Date, exam.date)
        .input('title', sql.NVarChar(200), exam.title)
        .query(`
          SELECT id FROM dbo.MockExams
          WHERE student_id = @studentId AND kind = N'brans' AND (exam_date = @examDate OR title = @title);
        `)
      if (existing.recordset.length > 0) {
        console.log(`ATLANDI "${exam.title}": zaten kayıt var (id=${existing.recordset[0].id}).`)
        continue
      }

      const subjectResult = await pool
        .request()
        .input('subjectName', sql.NVarChar(100), exam.subject)
        .query(`SELECT id FROM dbo.Subjects WHERE name = @subjectName;`)
      if (subjectResult.recordset.length !== 1) throw new Error(`"${exam.subject}" dersi tekil bulunamadı.`)
      const subjectId = subjectResult.recordset[0].id

      const [br, brt, sr, srt, tr, trt] = exam.overall
      console.log(
        `"${exam.title}" (${exam.date}) ${exam.subject}: D${exam.dyb[0]}/Y${exam.dyb[1]}/B${exam.dyb[2]} puan=${exam.score} ` +
          `sıra ${br}/${brt}, ${sr}/${srt}, ${tr}/${trt} ort=${exam.avg ? exam.avg.join('/') : '—'}`,
      )
      if (!apply) continue

      const examId = await insertExam(pool, exam, subjectId)
      console.log(`  → eklendi: id=${examId}`)
    }

    if (!apply) console.log('\nDry-run: hiçbir şey yazılmadı. Uygulamak için --apply ekleyin.')
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
