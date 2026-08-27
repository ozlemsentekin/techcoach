-- "Okul Ödevi" görevlerinin bağlandığı okul kaynağı (bkz. dbo.SchoolClassResources).
-- Eski okul ödevi görevleri resource_book_id (kütüphane 'okul' kitapları) ile çalışmaya
-- devam eder; yeni akış school_resource_id kullanır.
ALTER TABLE dbo.Tasks
    ADD school_resource_id UNIQUEIDENTIFIER NULL
        CONSTRAINT FK_Tasks_SchoolResourceId REFERENCES dbo.SchoolClassResources(id);
GO
