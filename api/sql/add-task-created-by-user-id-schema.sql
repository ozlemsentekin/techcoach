-- Görevi haftalık plana kimin eklediğini kişi bazında saklar (rol için created_by ayrı kalır).
-- Haftalık plan kartlarındaki "Ad Soyad (Rol)" etiketi bunun Users.full_name ile join'inden gelir.
-- Not: prod (techcoach-db) tablosunda bu kolon zaten mevcut — guard sayesinde no-op. Diğer
-- ortamlar / yeniden kurulum için tutuluyor. Eski satırlarda NULL kalır; o kartlarda etiket
-- öğrenci→veli / öğrenci adı ya da öğretmen dersi (StudentTeachers) üzerinden çözülür.
IF COL_LENGTH('dbo.Tasks', 'created_by_user_id') IS NULL
BEGIN
    ALTER TABLE dbo.Tasks
        ADD created_by_user_id UNIQUEIDENTIFIER NULL
            CONSTRAINT FK_Tasks_CreatedByUserId REFERENCES dbo.Users(id);
END;
GO
