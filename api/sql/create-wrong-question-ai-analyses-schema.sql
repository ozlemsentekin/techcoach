-- AI Raporları: bir raporun ürettiği soru bazlı analiz (ne sordu / olası hata), Hata Defteri'nde
-- o soru üzerinde küçük bir AI rozeti + tıklayınca analizi göstermek için ayrı, sorgulanabilir bir
-- tabloda tutulur (rapor json'ının içinde gömülü kalması yerine — bkz. dbo.AiAnalysisReports).
-- Bir soru en fazla bir kez analiz edilebildiğinden (WrongQuestions.ai_analyzed_at damgası bir
-- daha seçilmesini engelliyor) ilişki 1:1'dir.
IF OBJECT_ID('dbo.WrongQuestionAiAnalyses', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.WrongQuestionAiAnalyses (
      id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
      wrong_question_id UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_WrongQuestionAiAnalyses_WrongQuestion
          REFERENCES dbo.WrongQuestions(id) ON DELETE CASCADE,
      ai_analysis_report_id UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_WrongQuestionAiAnalyses_Report
          REFERENCES dbo.AiAnalysisReports(id),
      what_it_asked NVARCHAR(MAX) NOT NULL,
      likely_mistake NVARCHAR(MAX) NOT NULL,
      created_at DATETIME2 NOT NULL CONSTRAINT DF_WrongQuestionAiAnalyses_CreatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT UQ_WrongQuestionAiAnalyses_WrongQuestion UNIQUE (wrong_question_id)
  );
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_WrongQuestionAiAnalyses_ReportId' AND object_id = OBJECT_ID('dbo.WrongQuestionAiAnalyses')
)
BEGIN
  CREATE INDEX IX_WrongQuestionAiAnalyses_ReportId ON dbo.WrongQuestionAiAnalyses (ai_analysis_report_id);
END;
GO
