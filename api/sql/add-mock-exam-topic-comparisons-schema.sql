-- Deneme Sınavları konu grubu bazında karşılaştırma: sınav kurumu raporlarında ders
-- geneli puan/sıra karşılaştırmasının (bkz. add-mock-exam-comparison-stats-schema.sql)
-- yanında, konu grubu (ör. "Sözcük Grubunda Anlam") bazında da öğrenci puanı + sınıf/
-- okul/Türkiye ortalaması yer alır. dbo.MockExamQuestions.topic_name'den farklı olarak
-- burada tek bir soru değil, bir konu GRUBU için toplu bir karşılaştırma satırı tutulur.
-- Tamamen isteğe bağlıdır; rank alanı yok (raporlarda konu grubu seviyesinde sıra
-- bilgisi bulunmuyor).
IF OBJECT_ID('dbo.MockExamTopicComparisons', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.MockExamTopicComparisons (
      id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
      mock_exam_subject_id UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_MockExamTopicComparisons_Subject
          REFERENCES dbo.MockExamSubjects(id) ON DELETE CASCADE,
      order_no INT NOT NULL,
      topic_name NVARCHAR(200) NOT NULL,
      score DECIMAL(6, 2) NULL,
      class_avg_score DECIMAL(6, 2) NULL,
      school_avg_score DECIMAL(6, 2) NULL,
      turkey_avg_score DECIMAL(6, 2) NULL,
      created_at DATETIME2 NOT NULL CONSTRAINT DF_MockExamTopicComparisons_CreatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT UQ_MockExamTopicComparisons_SubjectOrder UNIQUE (mock_exam_subject_id, order_no)
  );
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_MockExamTopicComparisons_SubjectId' AND object_id = OBJECT_ID('dbo.MockExamTopicComparisons')
)
BEGIN
  CREATE INDEX IX_MockExamTopicComparisons_SubjectId ON dbo.MockExamTopicComparisons (mock_exam_subject_id);
END;
GO
