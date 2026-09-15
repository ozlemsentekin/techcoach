-- Hata Analiz: bir soruya birden fazla görsel eklenebilsin diye (slayt gibi gezinme + yazdırma)
-- tek sütun (WrongQuestions.analysis_photo_url) yerine ayrı bir tabloya taşındı. Sadece veli satır
-- ekler/siler; öğrenci ve öğretmen salt-okuma gezer. bkz. api/src/progress.js, api/src/teacher.js.
IF OBJECT_ID('dbo.WrongQuestionAnalysisPhotos', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.WrongQuestionAnalysisPhotos (
      id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
      wrong_question_id UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_WrongQuestionAnalysisPhotos_WrongQuestion
          REFERENCES dbo.WrongQuestions(id) ON DELETE CASCADE,
      photo_url NVARCHAR(MAX) NOT NULL,
      added_by_user_id UNIQUEIDENTIFIER NULL
          CONSTRAINT FK_WrongQuestionAnalysisPhotos_User REFERENCES dbo.Users(id),
      created_at DATETIME2 NOT NULL CONSTRAINT DF_WrongQuestionAnalysisPhotos_CreatedAt DEFAULT SYSUTCDATETIME()
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_WrongQuestionAnalysisPhotos_WrongQuestionId'
    AND object_id = OBJECT_ID('dbo.WrongQuestionAnalysisPhotos')
)
BEGIN
  CREATE INDEX IX_WrongQuestionAnalysisPhotos_WrongQuestionId
  ON dbo.WrongQuestionAnalysisPhotos (wrong_question_id);
END
GO

-- Backfill: PR #126 ile eklenen tek-görsel kolonunda veri varsa (kısa süre canlıda kaldı) ilk
-- satıra taşınır. Eski kolonlar (WrongQuestions.analysis_photo_url / _added_by / _added_at) geri
-- dönüş güvenliği için yerinde bırakılır; yeni kod onları okumaz/yazmaz.
INSERT INTO dbo.WrongQuestionAnalysisPhotos (wrong_question_id, photo_url, added_by_user_id, created_at)
SELECT wq.id, wq.analysis_photo_url, wq.analysis_photo_added_by, COALESCE(wq.analysis_photo_added_at, SYSUTCDATETIME())
FROM dbo.WrongQuestions wq
WHERE wq.analysis_photo_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM dbo.WrongQuestionAnalysisPhotos p WHERE p.wrong_question_id = wq.id
  );
GO
