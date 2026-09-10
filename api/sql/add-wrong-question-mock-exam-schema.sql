-- Deneme Sınavı hata görselleri Hata Defteri'nde de görünsün diye dbo.WrongQuestions
-- tekrar kullanılır. Deneme kaynaklı satırlar:
--   error_type = 'deneme', test_id = NULL, book_name = 'Deneme Sınavları',
--   subject = ders adı, topic = "<ders> · <tarih|Etüt>", mock_exam_subject_id dolu.
-- listWrongQuestionsHandler (progress.js) artık test_id IS NOT NULL yerine
-- (test_id IS NOT NULL OR mock_exam_subject_id IS NOT NULL) satırlarını döner.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.WrongQuestions') AND name = 'mock_exam_subject_id'
)
BEGIN
  ALTER TABLE dbo.WrongQuestions ADD mock_exam_subject_id UNIQUEIDENTIFIER NULL
      CONSTRAINT FK_WrongQuestions_MockExamSubject REFERENCES dbo.MockExamSubjects(id);
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_WrongQuestions_MockExamSubjectId'
    AND object_id = OBJECT_ID('dbo.WrongQuestions')
)
BEGIN
  CREATE INDEX IX_WrongQuestions_MockExamSubjectId
  ON dbo.WrongQuestions (mock_exam_subject_id);
END;
GO
