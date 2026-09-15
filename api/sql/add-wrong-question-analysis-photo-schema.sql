-- Hata Defteri: "Hata Analiz" görseli. Eski rol bazlı metin analizi (dbo.WrongQuestionAnalyses)
-- veli/öğrenci akışından kaldırılıp yerine tek bir görsel geldi — sadece veli ekler/değiştirir,
-- öğrenci ve öğretmen sadece görüntüler ("Analizi göster"). Öğretmenin kendi metin tabanlı
-- analiz kulvarı (role='ogretmen') değişmeden kalır.
IF COL_LENGTH('dbo.WrongQuestions', 'analysis_photo_url') IS NULL
BEGIN
  ALTER TABLE dbo.WrongQuestions ADD analysis_photo_url NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.WrongQuestions', 'analysis_photo_added_by') IS NULL
BEGIN
  ALTER TABLE dbo.WrongQuestions ADD analysis_photo_added_by UNIQUEIDENTIFIER NULL
      CONSTRAINT FK_WrongQuestions_AnalysisPhotoAddedBy REFERENCES dbo.Users(id);
END
GO

IF COL_LENGTH('dbo.WrongQuestions', 'analysis_photo_added_at') IS NULL
BEGIN
  ALTER TABLE dbo.WrongQuestions ADD analysis_photo_added_at DATETIME2 NULL;
END
GO
