-- AI Raporları: bir öğrencinin Hata Defteri'ndeki hata görsellerinden üretilen konu-eksiği
-- analizleri. Kullanıcı (veli/öğrenci/öğretmen) bir ders + o derste hata görseli olan içerikleri
-- seçer, görseller Claude'a gönderilir ve yapılandırılmış bir rapor (report_json) üretilip burada
-- saklanır. Rapor öğrenciye aittir; öğrenciyi görebilen her rol raporlarını görür (rol kulvarı yok).
IF OBJECT_ID('dbo.AiAnalysisReports', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.AiAnalysisReports (
      id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
      student_id UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_AiAnalysisReports_Student
          REFERENCES dbo.Users(id) ON DELETE CASCADE,
      subject NVARCHAR(100) NOT NULL,             -- dbo.WrongQuestions.subject ile aynı biçim
      topic_names_json NVARCHAR(MAX) NOT NULL,    -- analiz edilen içerik adları (JSON dizi)
      wrong_question_ids_json NVARCHAR(MAX) NOT NULL, -- analiz edilen dbo.WrongQuestions.id (JSON dizi)
      report_json NVARCHAR(MAX) NOT NULL,         -- yapılandırılmış rapor
      question_count INT NOT NULL,
      model NVARCHAR(50) NOT NULL,
      created_by_user_id UNIQUEIDENTIFIER NULL
          CONSTRAINT FK_AiAnalysisReports_User REFERENCES dbo.Users(id),
      created_by_role NVARCHAR(20) NOT NULL,      -- 'ogrenci' | 'ebeveyn' | 'ogretmen' (gösterim)
      created_at DATETIME2 NOT NULL CONSTRAINT DF_AiAnalysisReports_CreatedAt DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_AiAnalysisReports_Student_Subject_CreatedAt'
    AND object_id = OBJECT_ID('dbo.AiAnalysisReports')
)
BEGIN
  CREATE INDEX IX_AiAnalysisReports_Student_Subject_CreatedAt
  ON dbo.AiAnalysisReports (student_id, subject, created_at DESC);
END;
GO
