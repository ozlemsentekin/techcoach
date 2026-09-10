-- Deneme Sınavları modülü: öğrenci/veli panelinde "Çalışma Sonuçları" altındaki
-- Deneme Sınavları menüsü bu tabloları okur/yazar.
--   kind = 'brans' (Branş İzleme, tek ders, sabit 20 soru, tarih zorunlu)
--        | 'genel' (Genel Deneme, 8. sınıf LGS 6 dersi, ders başına sabit soru, tarih zorunlu)
--        | 'etut'  (Etüt, tek ders, toplam soru serbest, tarih opsiyonel)
-- brans/etut → tam olarak 1 MockExamSubjects satırı; genel → 6 satır.
-- Yanlış/boş soru fotoğrafları dbo.WrongQuestions'a yazılır (bkz.
-- add-wrong-question-mock-exam-schema.sql) ve Hata Defteri'nde "Deneme Sınavları"
-- kaynağı altında da görünür.
IF OBJECT_ID('dbo.MockExams', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.MockExams (
      id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
      student_id UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_MockExams_StudentId REFERENCES dbo.Users(id),
      kind NVARCHAR(20) NOT NULL
          CONSTRAINT CK_MockExams_Kind CHECK (kind IN (N'brans', N'genel', N'etut')),
      exam_date DATE NULL,
      title NVARCHAR(200) NULL,
      created_by_user_id UNIQUEIDENTIFIER NULL
          CONSTRAINT FK_MockExams_CreatedBy REFERENCES dbo.Users(id),
      created_at DATETIME2 NOT NULL CONSTRAINT DF_MockExams_CreatedAt DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 NOT NULL CONSTRAINT DF_MockExams_UpdatedAt DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_MockExams_StudentId' AND object_id = OBJECT_ID('dbo.MockExams')
)
BEGIN
  CREATE INDEX IX_MockExams_StudentId ON dbo.MockExams (student_id, exam_date DESC);
END;
GO

IF OBJECT_ID('dbo.MockExamSubjects', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.MockExamSubjects (
      id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
      mock_exam_id UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_MockExamSubjects_MockExam
          REFERENCES dbo.MockExams(id) ON DELETE CASCADE,
      subject_id UNIQUEIDENTIFIER NULL
          CONSTRAINT FK_MockExamSubjects_SubjectId REFERENCES dbo.Subjects(id),
      subject_name NVARCHAR(100) NOT NULL,
      total_questions INT NOT NULL CONSTRAINT CK_MockExamSubjects_Total CHECK (total_questions > 0),
      correct_count INT NOT NULL CONSTRAINT DF_MockExamSubjects_Correct DEFAULT 0,
      wrong_count INT NOT NULL CONSTRAINT DF_MockExamSubjects_Wrong DEFAULT 0,
      blank_count INT NOT NULL CONSTRAINT DF_MockExamSubjects_Blank DEFAULT 0
  );
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_MockExamSubjects_ExamId' AND object_id = OBJECT_ID('dbo.MockExamSubjects')
)
BEGIN
  CREATE INDEX IX_MockExamSubjects_ExamId ON dbo.MockExamSubjects (mock_exam_id);
END;
GO
