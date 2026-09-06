-- dbo.Subjects: hangi sınıf seviyelerinde okutulduğu bilgisi.
-- grades_json = JSON string dizisi, ör. ["5","6","7","8"]. NULL = tüm sınıflar (1-8).
-- Yeni çocuk profili oluşturulurken (createStudentHandler) öğrencinin sınıfına uyan
-- aktif dersler otomatik atanır; admin "Dersler" ekranından düzenlenebilir.

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.Subjects') AND name = 'grades_json'
)
BEGIN
  ALTER TABLE dbo.Subjects ADD grades_json NVARCHAR(200) NULL;
END
GO

-- Mevcut derslere makul MEB varsayılanları (ada göre; eşleşmeyen ders NULL = tüm sınıflar kalır).
UPDATE dbo.Subjects SET grades_json = N'["1","2","3","4","5","6","7","8"]' WHERE name IN (N'Türkçe', N'Matematik');
UPDATE dbo.Subjects SET grades_json = N'["2","3","4","5","6","7","8"]'     WHERE name = N'İngilizce';
UPDATE dbo.Subjects SET grades_json = N'["3","4","5","6","7","8"]'         WHERE name = N'Fen Bilimleri';
UPDATE dbo.Subjects SET grades_json = N'["4","5","6","7","8"]'             WHERE name IN (N'Din Kültürü ve Ahlak Bilgisi', N'Sosyal Bilgiler');
UPDATE dbo.Subjects SET grades_json = N'["5","6","7","8"]'                 WHERE name = N'Geometri';
UPDATE dbo.Subjects SET grades_json = N'["8"]'                             WHERE name = N'İnkılap Tarihi ve Atatürkçülük';
UPDATE dbo.Subjects SET grades_json = N'["9","10","11","12"]'             WHERE name IN (N'Biyoloji', N'Kimya', N'Fizik');
GO
