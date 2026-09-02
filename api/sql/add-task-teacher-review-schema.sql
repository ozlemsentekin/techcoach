-- Öğretmenin, tamamlanmış bir ödev/görevin sonucunu "kontrol edildi" olarak işaretlemesi.
-- Haftalık plan kartındaki optik sonucun altında ve açılan optik form içinde gösterilen
-- onay kutusu bu iki kolondan beslenir: reviewed_at (işaret zamanı) + reviewed_by_user_id
-- (işaretleyen öğretmen; kartta ad göstermek için Users.full_name ile join edilir).
-- Öğretmen işareti geri alabilir → her iki kolon da NULL'a çekilir.
IF COL_LENGTH('dbo.Tasks', 'reviewed_at') IS NULL
BEGIN
    ALTER TABLE dbo.Tasks ADD reviewed_at DATETIME2 NULL;
END;
GO

IF COL_LENGTH('dbo.Tasks', 'reviewed_by_user_id') IS NULL
BEGIN
    ALTER TABLE dbo.Tasks
        ADD reviewed_by_user_id UNIQUEIDENTIFIER NULL
            CONSTRAINT FK_Tasks_ReviewedByUserId REFERENCES dbo.Users(id);
END;
GO
