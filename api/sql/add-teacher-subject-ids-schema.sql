-- Öğretmenin branşını (birden fazla ders olabilir) tutar. Kayıt formunda seçilir, admin
-- üyeler panelinden de düzenlenebilir. Kütüphane sayfasında öğretmene sadece bu derslerin
-- sekmesi gösterilir (bkz. api/src/subjectIds.js, LibraryGradeDetailPage.jsx).
ALTER TABLE dbo.Users ADD teacher_subject_ids_json NVARCHAR(MAX) NULL;
GO
