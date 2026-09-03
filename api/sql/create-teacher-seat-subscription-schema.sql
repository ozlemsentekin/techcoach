-- Öğretmen ek öğrenci koltuğu abonelikleri. Öğretmenin taban panel aboneliğinin (4 öğrenci
-- dahil) ya da hiç aboneliği olmadığı durumda, satın aldığı öğrenci başı iyzico abonelikleri
-- burada tutulur. Her satır = 1 ek öğrenci koltuğu. Bir öğretmenin birden fazla satırı olabilir.
-- Idempotent — tekrar çalıştırılabilir. (dbo.ChildSeatSubscriptions'ın öğretmen karşılığı.)
IF OBJECT_ID('dbo.TeacherSeatSubscriptions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TeacherSeatSubscriptions (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY CONSTRAINT DF_TeacherSeatSubscriptions_Id DEFAULT NEWID(),
        teacher_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_TeacherSeatSubscriptions_Teacher REFERENCES dbo.Users(id),
        status NVARCHAR(20) NOT NULL,
        period NVARCHAR(10) NULL,
        product_id NVARCHAR(120) NULL,
        subscription_reference_code NVARCHAR(100) NULL,
        current_period_end DATETIME2 NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_TeacherSeatSubscriptions_CreatedAt DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_TeacherSeatSubscriptions_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_TeacherSeatSubscriptions_Status CHECK (status IN ('active', 'grace_period', 'cancelled', 'expired')),
        CONSTRAINT CK_TeacherSeatSubscriptions_Period CHECK (period IS NULL OR period IN ('monthly', 'yearly'))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TeacherSeatSubscriptions_TeacherId' AND object_id = OBJECT_ID('dbo.TeacherSeatSubscriptions'))
    CREATE INDEX IX_TeacherSeatSubscriptions_TeacherId ON dbo.TeacherSeatSubscriptions (teacher_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_TeacherSeatSubscriptions_SubscriptionReferenceCode' AND object_id = OBJECT_ID('dbo.TeacherSeatSubscriptions'))
    CREATE UNIQUE INDEX UX_TeacherSeatSubscriptions_SubscriptionReferenceCode
        ON dbo.TeacherSeatSubscriptions (subscription_reference_code)
        WHERE subscription_reference_code IS NOT NULL;
GO

CREATE OR ALTER TRIGGER dbo.TR_TeacherSeatSubscriptions_SetUpdatedAt
ON dbo.TeacherSeatSubscriptions
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE t
    SET updated_at = SYSUTCDATETIME()
    FROM dbo.TeacherSeatSubscriptions t
    INNER JOIN inserted i ON i.id = t.id;
END;
GO
