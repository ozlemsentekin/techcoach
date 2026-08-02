CREATE TABLE dbo.Entitlements (
    parent_id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY CONSTRAINT FK_Entitlements_Parent REFERENCES dbo.Users(id),
    status NVARCHAR(20) NOT NULL,
    source NVARCHAR(20) NOT NULL,
    product_id NVARCHAR(120) NULL,
    period NVARCHAR(10) NULL,
    current_period_end DATETIME2 NULL,
    revenuecat_app_user_id NVARCHAR(120) NULL,
    granted_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_Entitlements_GrantedBy REFERENCES dbo.Users(id),
    granted_reason NVARCHAR(255) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_Entitlements_CreatedAt DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_Entitlements_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Entitlements_Status CHECK (status IN ('none', 'trial', 'active', 'grace_period', 'cancelled', 'expired')),
    CONSTRAINT CK_Entitlements_Source CHECK (source IN ('comp', 'app_store', 'play_store')),
    CONSTRAINT CK_Entitlements_CompNoProduct CHECK (source <> 'comp' OR product_id IS NULL)
);
GO

CREATE OR ALTER TRIGGER dbo.TR_Entitlements_SetUpdatedAt
ON dbo.Entitlements
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE e
    SET updated_at = SYSUTCDATETIME()
    FROM dbo.Entitlements e
    INNER JOIN inserted i ON i.parent_id = e.parent_id;
END;
GO

CREATE TABLE dbo.EntitlementEvents (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    provider NVARCHAR(20) NOT NULL CONSTRAINT DF_EntitlementEvents_Provider DEFAULT 'revenuecat',
    provider_event_id NVARCHAR(200) NOT NULL,
    event_type NVARCHAR(60) NOT NULL,
    app_user_id NVARCHAR(120) NOT NULL,
    raw_payload NVARCHAR(MAX) NOT NULL,
    received_at DATETIME2 NOT NULL CONSTRAINT DF_EntitlementEvents_ReceivedAt DEFAULT SYSUTCDATETIME(),
    processed_at DATETIME2 NULL,
    processing_error NVARCHAR(MAX) NULL
);
GO

CREATE UNIQUE INDEX UX_EntitlementEvents_ProviderEventId ON dbo.EntitlementEvents (provider, provider_event_id);
GO
