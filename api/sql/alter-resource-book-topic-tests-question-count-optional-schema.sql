-- Soru sayısı artık test oluşturulurken zorunlu değil; cevap anahtarı girilmeden önce
-- ayrıca belirlenebiliyor. Bu yüzden question_count NULL olabilmeli.
ALTER TABLE dbo.ResourceBookTopicTests DROP CONSTRAINT CK_ResourceBookTopicTests_QuestionCount;
GO

ALTER TABLE dbo.ResourceBookTopicTests ALTER COLUMN question_count INT NULL;
GO

ALTER TABLE dbo.ResourceBookTopicTests ADD
    CONSTRAINT CK_ResourceBookTopicTests_QuestionCount CHECK (question_count IS NULL OR question_count > 0);
GO
