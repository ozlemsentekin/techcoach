-- Hata Defteri analiz akışı: rol başına TEK satır (upsert) modelinden, aynı soruya öğrenci/veli/
-- öğretmenin istediği kadar yorum bırakabildiği bir akışa (append-only thread) geçiş.
-- UNIQUE (wrong_question_id, role) bunu engellediği için kaldırılıyor — var olan satırlar (rol
-- başına tek yorum) olduğu gibi kalır, bundan sonra her ekleme yeni bir satır oluşturur.
IF EXISTS (
  SELECT 1 FROM sys.key_constraints
  WHERE name = 'UQ_WrongQuestionAnalyses_Question_Role'
    AND parent_object_id = OBJECT_ID('dbo.WrongQuestionAnalyses')
)
BEGIN
  ALTER TABLE dbo.WrongQuestionAnalyses DROP CONSTRAINT UQ_WrongQuestionAnalyses_Question_Role;
END;
GO
