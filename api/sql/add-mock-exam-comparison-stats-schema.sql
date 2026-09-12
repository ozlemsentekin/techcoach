-- Genel Deneme (LGS) sonuç raporlarında (sınav kurumunun PDF/portal çıktısı) her ders için
-- puan + şube/okul/genel sıra ve karşılaştırma ortalamaları (sınıf/okul/Türkiye) yer alır.
-- Bu alanlar isteğe bağlıdır: elle "Doğru/Yanlış/Boş" girişi yapan kullanıcı bunları hiç
-- doldurmayabilir, dolduran kullanıcı "Detay" bölümünden girer. class_label/school_label
-- sınav bazında sabittir (ör. "8D", "BİLFEN ESENŞEHİR İLKÖĞRETİM KURUMU"); Türkiye ortalaması
-- için ayrı bir etiket tutulmuyor, arayüzde sabit "Türkiye Ortalaması" metni kullanılıyor.
IF COL_LENGTH('dbo.MockExams', 'class_label') IS NULL
BEGIN
  ALTER TABLE dbo.MockExams ADD class_label NVARCHAR(50) NULL;
END;
GO

IF COL_LENGTH('dbo.MockExams', 'school_label') IS NULL
BEGIN
  ALTER TABLE dbo.MockExams ADD school_label NVARCHAR(200) NULL;
END;
GO

IF COL_LENGTH('dbo.MockExamSubjects', 'score') IS NULL
BEGIN
  ALTER TABLE dbo.MockExamSubjects ADD score DECIMAL(6, 2) NULL;
END;
GO

IF COL_LENGTH('dbo.MockExamSubjects', 'branch_rank') IS NULL
BEGIN
  ALTER TABLE dbo.MockExamSubjects ADD branch_rank INT NULL;
END;
GO

IF COL_LENGTH('dbo.MockExamSubjects', 'school_rank') IS NULL
BEGIN
  ALTER TABLE dbo.MockExamSubjects ADD school_rank INT NULL;
END;
GO

IF COL_LENGTH('dbo.MockExamSubjects', 'overall_rank') IS NULL
BEGIN
  ALTER TABLE dbo.MockExamSubjects ADD overall_rank INT NULL;
END;
GO

IF COL_LENGTH('dbo.MockExamSubjects', 'class_avg_score') IS NULL
BEGIN
  ALTER TABLE dbo.MockExamSubjects ADD class_avg_score DECIMAL(6, 2) NULL;
END;
GO

IF COL_LENGTH('dbo.MockExamSubjects', 'school_avg_score') IS NULL
BEGIN
  ALTER TABLE dbo.MockExamSubjects ADD school_avg_score DECIMAL(6, 2) NULL;
END;
GO

IF COL_LENGTH('dbo.MockExamSubjects', 'turkey_avg_score') IS NULL
BEGIN
  ALTER TABLE dbo.MockExamSubjects ADD turkey_avg_score DECIMAL(6, 2) NULL;
END;
GO
