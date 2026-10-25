-- Hata Kitapçığı: admin, Hata Defteri'ndeki fotoğraflı yanlışlardan seçim yapıp test üretir.
-- Her öğrenci + ders için TEK bir özel kaynak ("Hata Kitapçığı") ve onun altında tek bir içerik
-- (konu) açılır; her "Teste Dönüştür" bu içeriğe cevap anahtarlı yeni bir test ekler. Görev
-- ataması normal Kitaplık testleri gibi AddTaskDrawer'dan yapılır.
-- bkz. api/src/mistakeBooklets.js

IF OBJECT_ID('dbo.MistakeBooklets', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.MistakeBooklets (
      id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
      student_id UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_MistakeBooklets_Student REFERENCES dbo.Users(id),
      subject_id UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_MistakeBooklets_Subject REFERENCES dbo.Subjects(id),
      resource_book_id UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_MistakeBooklets_ResourceBook REFERENCES dbo.ResourceBooks(id) ON DELETE CASCADE,
      -- FK yok: ResourceBooks -> ResourceBookTopics zinciriyle çoklu cascade yolu oluşmasın diye.
      topic_id UNIQUEIDENTIFIER NOT NULL,
      created_at DATETIME2 NOT NULL CONSTRAINT DF_MistakeBooklets_CreatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT UQ_MistakeBooklets_Student_Subject UNIQUE (student_id, subject_id)
  );
END;
GO

-- Kitapçık testindeki her sorunun hangi Hata Defteri sorusundan üretildiği.
-- root_key: sorunun "kimliği" — aynı soru farklı kitapçık testlerine tekrar konsa ya da
-- kitapçıkta yeniden yanlış yapılsa bile aynı kalır; Hata Defteri'ndeki "kaç kez yanlış"
-- sayacı bu anahtarla gruplanır. Biçim: 't:<orijinal test_id>:<soru no>' (testli kayıtlar)
-- ya da 'w:<WrongQuestions.id>' (deneme/serbest kayıtlar).
-- source_wrong_question_id'de FK yok: kaynak hata kaydı silinse bile kitapçık testi bozulmasın.
IF OBJECT_ID('dbo.MistakeBookletQuestions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.MistakeBookletQuestions (
      id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
      test_id UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_MistakeBookletQuestions_Test REFERENCES dbo.ResourceBookTopicTests(id) ON DELETE CASCADE,
      order_no INT NOT NULL,
      source_wrong_question_id UNIQUEIDENTIFIER NULL,
      root_key NVARCHAR(120) NOT NULL,
      created_at DATETIME2 NOT NULL CONSTRAINT DF_MistakeBookletQuestions_CreatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT UQ_MistakeBookletQuestions_Test_Order UNIQUE (test_id, order_no)
  );
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_MistakeBookletQuestions_RootKey' AND object_id = OBJECT_ID('dbo.MistakeBookletQuestions')
)
BEGIN
  CREATE INDEX IX_MistakeBookletQuestions_RootKey ON dbo.MistakeBookletQuestions (root_key);
END;
GO
