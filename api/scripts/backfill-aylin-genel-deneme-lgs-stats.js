// One-off: Aylin Şişman'ın bugün (2026-09-12) panelden girdiği Genel Deneme (LGS) kaydına,
// sınav kurumu raporundaki (ekran görüntüleri) puan/şube-okul-genel sıra + sınıf/okul/Türkiye
// ortalaması verilerini yazar. Idempotent: MERGE değil ama koşulsuz UPDATE — birden çok kez
// çalıştırılsa da aynı sonucu verir. Varsayılan: dry-run (sadece bulduğu kaydı basar).
// Apply etmek için: node api/scripts/backfill-aylin-genel-deneme-lgs-stats.js --apply
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

const CLASS_LABEL = '8D'
const SCHOOL_LABEL = 'BİLFEN ESENŞEHİR İLKÖĞRETİM KURUMU'

// subjectName -> { score, branchRank, schoolRank, overallRank, classAvgScore, schoolAvgScore, turkeyAvgScore }
const SUBJECT_STATS = {
  'Türkçe': { score: 86.65, branchRank: 8, schoolRank: 46, overallRank: 1007, classAvgScore: 84.09, schoolAvgScore: 87.64, turkeyAvgScore: 87.36 },
  'Matematik': { score: 86.65, branchRank: 5, schoolRank: 25, overallRank: 454, classAvgScore: 67.72, schoolAvgScore: 74.46, turkeyAvgScore: 70.1 },
  'Fen Bilimleri': { score: 86.65, branchRank: 4, schoolRank: 25, overallRank: 572, classAvgScore: 67.95, schoolAvgScore: 73.87, turkeyAvgScore: 72.88 },
  'T.C. İnkılap Tarihi ve Atatürkçülük': { score: 86.7, branchRank: 8, schoolRank: 32, overallRank: 813, classAvgScore: 84.25, schoolAvgScore: 86.57, turkeyAvgScore: 87.57 },
  'İngilizce': { score: 100, branchRank: 1, schoolRank: 1, overallRank: 1, classAvgScore: 92.74, schoolAvgScore: 92.87, turkeyAvgScore: 89.96 },
  'Din Kültürü ve Ahlak Bilgisi': { score: 100, branchRank: 1, schoolRank: 1, overallRank: 1, classAvgScore: 86.07, schoolAvgScore: 85.85, turkeyAvgScore: 83.91 },
}

async function main() {
  const apply = process.argv.includes('--apply')
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(connectionString)
  try {
    const examResult = await pool
      .request()
      .input('studentId', sql.UniqueIdentifier, '427246B1-A97D-4611-B393-D5F6C1AB6915')
      .query(`
        SELECT TOP 1 e.id, e.exam_date, e.kind, u.full_name
        FROM dbo.MockExams e
        INNER JOIN dbo.Users u ON u.id = e.student_id
        WHERE e.student_id = @studentId AND e.kind = N'genel'
        ORDER BY e.created_at DESC;
      `)
    const exam = examResult.recordset[0]
    if (!exam) {
      console.log('Aylin ŞİŞMAN için Genel Deneme kaydı bulunamadı.')
      return
    }
    console.log(`Deneme bulundu: id=${exam.id} tarih=${exam.exam_date?.toISOString?.().slice(0, 10)}`)

    const subjectsResult = await pool
      .request()
      .input('examId2', sql.UniqueIdentifier, exam.id)
      .query(`
        SELECT id, subject_name, correct_count, wrong_count, blank_count
        FROM dbo.MockExamSubjects
        WHERE mock_exam_id = @examId2;
      `)
    console.log(`${subjectsResult.recordset.length} ders satırı bulundu:`)
    for (const row of subjectsResult.recordset) {
      const stats = SUBJECT_STATS[row.subject_name]
      console.log(
        `  - ${row.subject_name}: D${row.correct_count}/Y${row.wrong_count}/B${row.blank_count} ${
          stats ? `→ eşleşme bulundu (puan ${stats.score})` : '→ EŞLEŞME YOK'
        }`,
      )
    }

    if (!apply) {
      console.log('\nDry-run: hiçbir şey yazılmadı. Uygulamak için --apply ekleyin.')
      return
    }

    await pool
      .request()
      .input('examId', sql.UniqueIdentifier, exam.id)
      .input('classLabel', sql.NVarChar(50), CLASS_LABEL)
      .input('schoolLabel', sql.NVarChar(200), SCHOOL_LABEL)
      .query(`UPDATE dbo.MockExams SET class_label = @classLabel, school_label = @schoolLabel WHERE id = @examId;`)

    for (const row of subjectsResult.recordset) {
      const stats = SUBJECT_STATS[row.subject_name]
      if (!stats) continue
      await pool
        .request()
        .input('subjectRowId', sql.UniqueIdentifier, row.id)
        .input('score', sql.Decimal(6, 2), stats.score)
        .input('branchRank', sql.Int, stats.branchRank)
        .input('schoolRank', sql.Int, stats.schoolRank)
        .input('overallRank', sql.Int, stats.overallRank)
        .input('classAvgScore', sql.Decimal(6, 2), stats.classAvgScore)
        .input('schoolAvgScore', sql.Decimal(6, 2), stats.schoolAvgScore)
        .input('turkeyAvgScore', sql.Decimal(6, 2), stats.turkeyAvgScore).query(`
          UPDATE dbo.MockExamSubjects
          SET score = @score, branch_rank = @branchRank, school_rank = @schoolRank, overall_rank = @overallRank,
              class_avg_score = @classAvgScore, school_avg_score = @schoolAvgScore, turkey_avg_score = @turkeyAvgScore
          WHERE id = @subjectRowId;
        `)
    }

    console.log('\nUygulandı: MockExams + MockExamSubjects güncellendi.')
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
