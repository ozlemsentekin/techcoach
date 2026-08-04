ALTER TABLE dbo.Users ALTER COLUMN password_hash NVARCHAR(255) NULL;
GO

-- Email artık tercihen (opsiyonel) olduğu için NOT NULL kısıtı kaldırılır ve mevcut
-- UNIQUE INDEX, birden fazla NULL email'e izin verecek şekilde filtered index'e çevrilir
-- (SQL Server'da normal UNIQUE INDEX yalnızca tek bir NULL'a izin verir).
ALTER TABLE dbo.Users ALTER COLUMN email NVARCHAR(320) NULL;
GO

DROP INDEX UX_Users_Email ON dbo.Users;
GO

CREATE UNIQUE INDEX UX_Users_Email ON dbo.Users (email) WHERE email IS NOT NULL;
GO

ALTER TABLE dbo.Users ADD phone_number NVARCHAR(20) NULL;
GO

CREATE UNIQUE INDEX UX_Users_Phone ON dbo.Users (phone_number) WHERE phone_number IS NOT NULL;
GO

CREATE TABLE dbo.OtpCodes (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    phone_number NVARCHAR(20) NOT NULL,
    purpose NVARCHAR(20) NOT NULL, -- 'login' | 'register'
    code_hash NVARCHAR(128) NOT NULL,
    attempt_count INT NOT NULL CONSTRAINT DF_OtpCodes_AttemptCount DEFAULT 0,
    consumed_at DATETIME2 NULL,
    expires_at DATETIME2 NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_OtpCodes_CreatedAt DEFAULT SYSUTCDATETIME(),
    -- register'a özgü: doğrulama başarılı olunca kullanıcı oluşturmak için bekleyen alanlar
    pending_full_name NVARCHAR(120) NULL,
    pending_email NVARCHAR(320) NULL
);
GO

CREATE INDEX IX_OtpCodes_Phone_Purpose ON dbo.OtpCodes (phone_number, purpose, created_at DESC);
GO

-- dbo.Users artık filtered unique index'ler (UX_Users_Email, UX_Users_Phone) içerdiği için,
-- tabloya UPDATE yapan her oturumun QUOTED_IDENTIFIER ON ile çalışması gerekir. Bu, çağıran
-- oturumun ayarından bağımsız olarak TETİKLEYİCİNİN OLUŞTURULDUĞU ANDAKİ ayarla sabitlenir.
-- Mevcut TR_Users_SetUpdatedAt eski bir QUOTED_IDENTIFIER OFF oturumuyla oluşturulmuşsa,
-- migration sonrası dbo.Users üzerindeki HER UPDATE (login, last_login_at, failed_login_count vb.)
-- "SET options have incorrect settings: 'QUOTED_IDENTIFIER'" hatasıyla başarısız olur.
-- Bu yüzden tetikleyici burada QUOTED_IDENTIFIER ON garantisiyle yeniden oluşturulur.
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER TRIGGER dbo.TR_Users_SetUpdatedAt
ON dbo.Users
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE u
    SET updated_at = SYSUTCDATETIME()
    FROM dbo.Users u
    INNER JOIN inserted i ON i.id = u.id;
END;
GO
