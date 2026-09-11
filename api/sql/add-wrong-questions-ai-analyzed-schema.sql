-- AI Raporları: bir yanlış sorunun görseli daha önce bir AI raporuna dahil edildiyse bir
-- daha "Yeni Rapor Oluştur" seçim listesinde görünmesin / tekrar Claude'a gönderilmesin diye
-- WrongQuestions'a "ne zaman analiz edildi" damgası eklenir.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.WrongQuestions') AND name = 'ai_analyzed_at'
)
BEGIN
  ALTER TABLE dbo.WrongQuestions ADD ai_analyzed_at DATETIME2 NULL;
END;
GO

-- Geriye dönük doldurma: bu sütun eklenmeden önce üretilmiş raporların kapsadığı sorular da
-- "analiz edildi" sayılsın (aksi hâlde aynı görseller bir sonraki rapor seçiminde tekrar çıkar).
;WITH ReportQuestions AS (
  SELECT r.created_at, TRY_CONVERT(UNIQUEIDENTIFIER, j.[value]) AS wrong_question_id
  FROM dbo.AiAnalysisReports r
  CROSS APPLY OPENJSON(r.wrong_question_ids_json) j
)
UPDATE wq
SET wq.ai_analyzed_at = rq.created_at
FROM dbo.WrongQuestions wq
JOIN ReportQuestions rq ON rq.wrong_question_id = wq.id
WHERE wq.ai_analyzed_at IS NULL;
GO
