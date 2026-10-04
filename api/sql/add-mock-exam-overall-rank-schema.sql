-- Genel Deneme (LGS) sonuç raporlarındaki üst özet satırı (Şube Sıra "4/22", Okul Sıra "31/93",
-- Genel/Türkiye Sıra "603/2056" gibi) sınav genelinde tek bir değerdir — ders bazlı
-- MockExamSubjects.branch_rank/school_rank/overall_rank'ten ayrı olarak dbo.MockExams'ta tutulur.
-- Her sıra için hem "kaçıncı" (rank) hem "kaç kişi içinde" (total) saklanır; ikisi de isteğe
-- bağlıdır (rapor bu satırı içermeyebilir).
IF COL_LENGTH('dbo.MockExams', 'overall_branch_rank') IS NULL
BEGIN
  ALTER TABLE dbo.MockExams ADD overall_branch_rank INT NULL;
END;
GO

IF COL_LENGTH('dbo.MockExams', 'overall_branch_rank_total') IS NULL
BEGIN
  ALTER TABLE dbo.MockExams ADD overall_branch_rank_total INT NULL;
END;
GO

IF COL_LENGTH('dbo.MockExams', 'overall_school_rank') IS NULL
BEGIN
  ALTER TABLE dbo.MockExams ADD overall_school_rank INT NULL;
END;
GO

IF COL_LENGTH('dbo.MockExams', 'overall_school_rank_total') IS NULL
BEGIN
  ALTER TABLE dbo.MockExams ADD overall_school_rank_total INT NULL;
END;
GO

IF COL_LENGTH('dbo.MockExams', 'overall_turkey_rank') IS NULL
BEGIN
  ALTER TABLE dbo.MockExams ADD overall_turkey_rank INT NULL;
END;
GO

IF COL_LENGTH('dbo.MockExams', 'overall_turkey_rank_total') IS NULL
BEGIN
  ALTER TABLE dbo.MockExams ADD overall_turkey_rank_total INT NULL;
END;
GO
