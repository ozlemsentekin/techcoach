// Bu script eklenmeden önce üretilmiş AiAnalysisReports satırlarının kapsadığı soruları
// dbo.WrongQuestionAiAnalyses'e geriye dönük yazar (Hata Defteri'ndeki AI rozeti/analizi bu
// tablodan okunuyor — bkz. api/src/aiAnalysis.js insertWrongQuestionAiAnalyses). İdempotenttir:
// zaten bir satırı olan soruyu atlar, güvenle tekrar çalıştırılabilir.
//
// Usage: node api/scripts/backfill-wrong-question-ai-analyses.js
const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const localSettingsPath = path.join(__dirname, '..', 'local.settings.json')
function loadLocalSettings() {
  if (!fs.existsSync(localSettingsPath)) return
  const parsed = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([k, v]) => {
    if (!process.env[k] && typeof v === 'string') process.env[k] = v
  })
}

// api/src/aiAnalysis.js'deki matchAnalysisToRows ile aynı eşleme mantığı (imageIndex varsa onunla,
// yoksa sırayla) — kopya, çünkü o dosya server-runtime'a bağlı (getAnthropicConfig vb. gerektiriyor).
function matchAnalysisToIds(report, ids) {
  const analyzed = report?.analyzedQuestions || []
  const hasIndex = analyzed.length > 0 && analyzed.every((q) => Number.isInteger(q.imageIndex))
  const byIndex = new Map()
  analyzed.forEach((q, i) => {
    const idx = hasIndex ? q.imageIndex - 1 : i
    if (idx >= 0 && idx < ids.length && !byIndex.has(idx)) byIndex.set(idx, q)
  })
  return ids.map((id, idx) => ({ id, analysis: byIndex.get(idx) || null }))
}

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const reports = (
      await pool.request().query(`SELECT id, report_json, wrong_question_ids_json FROM dbo.AiAnalysisReports;`)
    ).recordset
    console.log(`${reports.length} rapor bulundu.`)

    let inserted = 0
    let skippedExisting = 0
    let skippedNoAnalysis = 0

    for (const report of reports) {
      let parsedReport
      let ids
      try {
        parsedReport = JSON.parse(report.report_json)
        ids = JSON.parse(report.wrong_question_ids_json)
      } catch (err) {
        console.warn(`Rapor ${report.id}: JSON parse hatası, atlanıyor.`, err.message)
        continue
      }
      if (!Array.isArray(ids) || !ids.length) continue

      for (const { id, analysis } of matchAnalysisToIds(parsedReport, ids)) {
        if (!analysis) {
          skippedNoAnalysis += 1
          continue
        }
        const existing = await pool.request().input('id', sql.UniqueIdentifier, id).query(`
          SELECT 1 FROM dbo.WrongQuestionAiAnalyses WHERE wrong_question_id = @id;
        `)
        if (existing.recordset.length) {
          skippedExisting += 1
          continue
        }
        await pool
          .request()
          .input('wrongQuestionId', sql.UniqueIdentifier, id)
          .input('reportId', sql.UniqueIdentifier, report.id)
          .input('whatItAsked', sql.NVarChar(sql.MAX), analysis.whatItAsked)
          .input('likelyMistake', sql.NVarChar(sql.MAX), analysis.likelyMistake).query(`
            INSERT INTO dbo.WrongQuestionAiAnalyses (wrong_question_id, ai_analysis_report_id, what_it_asked, likely_mistake)
            VALUES (@wrongQuestionId, @reportId, @whatItAsked, @likelyMistake);
          `)
        inserted += 1
      }
    }

    console.log(`Eklendi: ${inserted}, zaten vardı: ${skippedExisting}, eşleşen analiz yok: ${skippedNoAnalysis}.`)
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
