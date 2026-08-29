CREATE TABLE dbo.PendingParentRegistrations (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    full_name NVARCHAR(120) NOT NULL,
    phone_number NVARCHAR(20) NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    aydinlatma_accepted_at DATETIME2 NOT NULL,
    kvkk_accepted_at DATETIME2 NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_PendingParentRegistrations_CreatedAt DEFAULT SYSUTCDATETIME(),
    expires_at DATETIME2 NOT NULL,
    consumed_at DATETIME2 NULL
);
GO

CREATE INDEX IX_PendingParentRegistrations_Phone ON dbo.PendingParentRegistrations (phone_number);
GO
