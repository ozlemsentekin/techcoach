-- Basit kitap (content_mode='simple') görev tamamlamasından ve Hata Defteri'nin serbest
-- "+ Hata Ekle" akışından gelen kayıtlar için gerçek bir kitap ilişkisi: bu satırlarda test_id
-- yoktur (test hiç yok), bu yüzden book_name metin eşleştirmesi yerine doğrudan ResourceBooks'a
-- bağlanır — kitaba göre gruplama/analiz (Hata Defteri "Kaynağa Göre") isim değişikliklerinden
-- etkilenmesin diye. bkz. api/src/tasks.js (saveSimpleTaskResultHandler),
-- api/src/progress.js (addWrongQuestionHandler, listWrongQuestionsHandler).

IF COL_LENGTH('dbo.WrongQuestions', 'resource_book_id') IS NULL
BEGIN
  ALTER TABLE dbo.WrongQuestions ADD resource_book_id UNIQUEIDENTIFIER NULL
      CONSTRAINT FK_WrongQuestions_ResourceBookId REFERENCES dbo.ResourceBooks(id);
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_WrongQuestions_ResourceBookId' AND object_id = OBJECT_ID(N'dbo.WrongQuestions')
)
BEGIN
  CREATE INDEX IX_WrongQuestions_ResourceBookId ON dbo.WrongQuestions (resource_book_id);
END
GO
