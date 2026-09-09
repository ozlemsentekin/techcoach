-- Hata Defteri: rol bazlı hata analizi kulvarları.
-- Önceden bir yanlış sorunun analizi tek yerde tutuluyordu (dbo.WrongQuestions.mistake_reason +
-- student_note) ve hem öğrenci/veli hem öğretmen aynı kolonlara yazıyordu — biri diğerini eziyordu.
-- Artık her rol (ogrenci | ebeveyn | ogretmen) kendi kulvarında bağımsız analiz yapar; UNIQUE
-- (wrong_question_id, role) her soruda rol başına tek kayıt garantiler. "Analiz edilmiş" sayılmak
-- için mistake_reason dolu olmalıdır (note opsiyonel).
IF OBJECT_ID('dbo.WrongQuestionAnalyses', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.WrongQuestionAnalyses (
      id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
      wrong_question_id UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_WrongQuestionAnalyses_WrongQuestion
          REFERENCES dbo.WrongQuestions(id) ON DELETE CASCADE,
      role NVARCHAR(20) NOT NULL,           -- 'ogrenci' | 'ebeveyn' | 'ogretmen'
      mistake_reason NVARCHAR(30) NULL,     -- progress.js MISTAKE_REASONS içinden
      note NVARCHAR(1000) NULL,
      analyzed_by_user_id UNIQUEIDENTIFIER NULL
          CONSTRAINT FK_WrongQuestionAnalyses_User REFERENCES dbo.Users(id),
      created_at DATETIME2 NOT NULL CONSTRAINT DF_WrongQuestionAnalyses_CreatedAt DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 NOT NULL CONSTRAINT DF_WrongQuestionAnalyses_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT UQ_WrongQuestionAnalyses_Question_Role UNIQUE (wrong_question_id, role)
  );
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_WrongQuestionAnalyses_WrongQuestionId'
    AND object_id = OBJECT_ID('dbo.WrongQuestionAnalyses')
)
BEGIN
  CREATE INDEX IX_WrongQuestionAnalyses_WrongQuestionId
  ON dbo.WrongQuestionAnalyses (wrong_question_id);
END;
GO

-- Backfill: eski tek-kulvarlı analiz (mistake_reason veya student_note dolu) öğrenci kulvarına taşınır.
-- Eski kolonlar (dbo.WrongQuestions.mistake_reason / student_note) geri dönüş güvenliği için
-- yerinde bırakılır; yeni kod onları okumaz/yazmaz.
INSERT INTO dbo.WrongQuestionAnalyses (wrong_question_id, role, mistake_reason, note, analyzed_by_user_id)
SELECT wq.id, N'ogrenci', wq.mistake_reason, wq.student_note, wq.student_id
FROM dbo.WrongQuestions wq
WHERE (wq.mistake_reason IS NOT NULL OR wq.student_note IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM dbo.WrongQuestionAnalyses a
    WHERE a.wrong_question_id = wq.id AND a.role = N'ogrenci'
  );
GO
