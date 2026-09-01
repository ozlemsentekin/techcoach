-- Ek çocuk (çocuk-koltuğu) abonelikleri. Bir velinin kendi ödemeli planının / öğretmen
-- finansmanının kapsadığından FAZLA çocuk profili ekleyebilmesi için satın aldığı iyzico
-- abonelikleri burada tutulur. Her satır bir ek çocuk kotası = 1 koltuk. Bir velinin birden
-- fazla satırı olabilir. Idempotent — tekrar çalıştırılabilir.
IF OBJECT_ID('dbo.ChildSeatSubscriptions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ChildSeatSubscriptions (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY CONSTRAINT DF_ChildSeatSubscriptions_Id DEFAULT NEWID(),
        parent_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_ChildSeatSubscriptions_Parent REFERENCES dbo.Users(id),
        status NVARCHAR(20) NOT NULL,
        period NVARCHAR(10) NULL,
        product_id NVARCHAR(120) NULL,
        subscription_reference_code NVARCHAR(100) NULL,
        current_period_end DATETIME2 NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_ChildSeatSubscriptions_CreatedAt DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_ChildSeatSubscriptions_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_ChildSeatSubscriptions_Status CHECK (status IN ('active', 'grace_period', 'cancelled', 'expired')),
        CONSTRAINT CK_ChildSeatSubscriptions_Period CHECK (period IS NULL OR period IN ('monthly', 'yearly'))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChildSeatSubscriptions_ParentId' AND object_id = OBJECT_ID('dbo.ChildSeatSubscriptions'))
    CREATE INDEX IX_ChildSeatSubscriptions_ParentId ON dbo.ChildSeatSubscriptions (parent_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_ChildSeatSubscriptions_SubscriptionReferenceCode' AND object_id = OBJECT_ID('dbo.ChildSeatSubscriptions'))
    CREATE UNIQUE INDEX UX_ChildSeatSubscriptions_SubscriptionReferenceCode
        ON dbo.ChildSeatSubscriptions (subscription_reference_code)
        WHERE subscription_reference_code IS NOT NULL;
GO

CREATE OR ALTER TRIGGER dbo.TR_ChildSeatSubscriptions_SetUpdatedAt
ON dbo.ChildSeatSubscriptions
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE c
    SET updated_at = SYSUTCDATETIME()
    FROM dbo.ChildSeatSubscriptions c
    INNER JOIN inserted i ON i.id = c.id;
END;
GO
