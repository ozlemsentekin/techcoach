-- Deneme Sınavları — "Sınav Deneyimi Analizi": öğrencinin denemeden sonraki duygu durumu,
-- deneyim etiketleri, öğrenme notu, bir sonraki hedefi ve bir önceki hedefi uygulayıp
-- uygulayamadığına dair değerlendirmesi. Sadece öğrenci yazabilir (veli/öğretmen salt-okuma) —
-- bkz. api/src/mockExams.js updateMockExamExperienceHandler. mood/tag kod listeleri kasıtlı
-- olarak CHECK constraint'siz: yeni kod eklemek sadece kod tarafı (config) değişikliği,
-- migration gerektirmesin diye (bkz. MOCK_EXAM_KINDS/GENEL_DENEME_TEMPLATE ile aynı yaklaşım).
IF COL_LENGTH('dbo.MockExams', 'experience_mood') IS NULL
BEGIN
  ALTER TABLE dbo.MockExams ADD experience_mood NVARCHAR(30) NULL;
END;
GO

IF COL_LENGTH('dbo.MockExams', 'experience_learning_note') IS NULL
BEGIN
  ALTER TABLE dbo.MockExams ADD experience_learning_note NVARCHAR(500) NULL;
END;
GO

IF COL_LENGTH('dbo.MockExams', 'experience_next_action') IS NULL
BEGIN
  ALTER TABLE dbo.MockExams ADD experience_next_action NVARCHAR(300) NULL;
END;
GO

IF COL_LENGTH('dbo.MockExams', 'experience_previous_action_review') IS NULL
BEGIN
  ALTER TABLE dbo.MockExams ADD experience_previous_action_review NVARCHAR(20) NULL;
END;
GO

-- Hangi önceki denemenin hedefine karşılık verildiği: bir kez cevaplandıktan sonra dondurulur
-- (araya sonradan eklenen bir deneme geçmişi bozmasın diye) — bkz. mockExams.js
-- findPendingPreviousGoal. Kendine referans FK; SQL Server kendine referans FK'lerde
-- ON DELETE SET NULL/CASCADE'e izin vermiyor ("multiple cascade paths"), bu yüzden NO ACTION —
-- bir denemeyi silmeden önce ona referans veren satırları elle NULL'lamak gerekiyor,
-- bkz. deleteMockExamHandler.
IF COL_LENGTH('dbo.MockExams', 'experience_previous_mock_exam_id') IS NULL
BEGIN
  ALTER TABLE dbo.MockExams ADD experience_previous_mock_exam_id UNIQUEIDENTIFIER NULL
      CONSTRAINT FK_MockExams_ExperiencePreviousExam
      REFERENCES dbo.MockExams(id) ON DELETE NO ACTION;
END;
GO

IF COL_LENGTH('dbo.MockExams', 'experience_updated_at') IS NULL
BEGIN
  ALTER TABLE dbo.MockExams ADD experience_updated_at DATETIME2 NULL;
END;
GO

-- Deneyim etiketleri (çoklu seçim): süre yönetimi, dikkat dağılması, optik form sorunu vb.
-- Sınav düzeyinde (subject değil) — CASCADE, MockExamSubjects ile aynı model.
IF OBJECT_ID('dbo.MockExamExperienceTags', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.MockExamExperienceTags (
      id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
      mock_exam_id UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_MockExamExperienceTags_MockExam
          REFERENCES dbo.MockExams(id) ON DELETE CASCADE,
      tag_code NVARCHAR(50) NOT NULL,
      created_at DATETIME2 NOT NULL CONSTRAINT DF_MockExamExperienceTags_CreatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT UQ_MockExamExperienceTags_ExamTag UNIQUE (mock_exam_id, tag_code)
  );
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_MockExamExperienceTags_ExamId' AND object_id = OBJECT_ID('dbo.MockExamExperienceTags')
)
BEGIN
  CREATE INDEX IX_MockExamExperienceTags_ExamId ON dbo.MockExamExperienceTags (mock_exam_id);
END;
GO
