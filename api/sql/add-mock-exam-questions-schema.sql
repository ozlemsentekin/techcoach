-- Deneme Sınavları soru bazlı konu etiketleme: her deneme dersinin (MockExamSubjects)
-- altına, isteğe bağlı olarak sorunun kendisi (durum + konu adı) eklenebilir. Bu tablo
-- doluysa o subject "soru bazlı" girilmiş demektir; boşsa eski basit mod (sadece toplam
-- D/Y/B) geçerlidir — iki mod aynı anda desteklenir.
-- wrong_question_id: yanlış/boş bir soruya fotoğraf eklenince oluşan dbo.WrongQuestions
-- satırına geri referans (Hata Defteri "fotoğrafı var" göstergesi + konu eşlemesi için).
-- ON DELETE SET NULL: deleteMockExamHandler önce WrongQuestions'ı, sonra MockExams'ı
-- (cascade ile MockExamSubjects -> MockExamQuestions) siliyor; bu yön CASCADE olsaydı
-- WrongQuestions silinirken bu tablo hâlâ referans veriyor olacağından silme sırası bozulurdu.
IF OBJECT_ID('dbo.MockExamQuestions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.MockExamQuestions (
      id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
      mock_exam_subject_id UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_MockExamQuestions_Subject
          REFERENCES dbo.MockExamSubjects(id) ON DELETE CASCADE,
      order_no INT NOT NULL,
      status NVARCHAR(10) NOT NULL
          CONSTRAINT CK_MockExamQuestions_Status CHECK (status IN (N'dogru', N'yanlis', N'bos')),
      topic_name NVARCHAR(200) NULL,
      wrong_question_id UNIQUEIDENTIFIER NULL
          CONSTRAINT FK_MockExamQuestions_WrongQuestion
          REFERENCES dbo.WrongQuestions(id) ON DELETE SET NULL,
      created_at DATETIME2 NOT NULL CONSTRAINT DF_MockExamQuestions_CreatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT UQ_MockExamQuestions_SubjectOrder UNIQUE (mock_exam_subject_id, order_no)
  );
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_MockExamQuestions_SubjectId' AND object_id = OBJECT_ID('dbo.MockExamQuestions')
)
BEGIN
  CREATE INDEX IX_MockExamQuestions_SubjectId ON dbo.MockExamQuestions (mock_exam_subject_id);
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_MockExamQuestions_Topic' AND object_id = OBJECT_ID('dbo.MockExamQuestions')
)
BEGIN
  CREATE INDEX IX_MockExamQuestions_Topic ON dbo.MockExamQuestions (topic_name)
  WHERE topic_name IS NOT NULL;
END;
GO
