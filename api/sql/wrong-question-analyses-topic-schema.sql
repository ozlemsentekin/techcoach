-- Öğretmen "Hata Analizi Oturumu" (bkz. teacher.js getTeacherMistakeAnalysisSessionHandler): öğretmen
-- her soru için "Sorunun konusu" + "Dikkat edilmesi gereken" yazar. Dikkat edilmesi gereken mevcut
-- note kolonuna gider; sorunun konusu analiz yorumuna ait ayrı bir alandır (WrongQuestions.topic
-- katalog konusuyla ezildiği için oraya yazılmaz — listelerde COALESCE(tp.name, wq.topic) okunur).
-- Eklemeli ve NULL'a izin veren kolon: eski satırlar/kod etkilenmez.
IF COL_LENGTH('dbo.WrongQuestionAnalyses', 'question_topic') IS NULL
BEGIN
  ALTER TABLE dbo.WrongQuestionAnalyses ADD question_topic NVARCHAR(200) NULL;
END;
GO
