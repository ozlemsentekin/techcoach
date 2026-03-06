CREATE TABLE dbo.Users (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    full_name NVARCHAR(120) NOT NULL,
    email NVARCHAR(320) NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    aydinlatma_accepted_at DATETIME2 NOT NULL,
    kvkk_accepted_at DATETIME2 NOT NULL,
    failed_login_count INT NOT NULL CONSTRAINT DF_Users_FailedLoginCount DEFAULT 0,
    lockout_until DATETIME2 NULL,
    last_login_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_Users_Email ON dbo.Users (email);
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
