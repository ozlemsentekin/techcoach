CREATE TABLE dbo.TeacherEntitlements (
    teacher_id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY CONSTRAINT FK_TeacherEntitlements_Teacher REFERENCES dbo.Users(id),
    status NVARCHAR(20) NOT NULL,
    source NVARCHAR(20) NOT NULL,
    product_id NVARCHAR(120) NULL,
    current_period_end DATETIME2 NULL,
    base_seats INT NOT NULL CONSTRAINT DF_TeacherEntitlements_BaseSeats DEFAULT 4,
    purchased_seats INT NOT NULL CONSTRAINT DF_TeacherEntitlements_PurchasedSeats DEFAULT 0,
    revenuecat_app_user_id NVARCHAR(120) NULL,
    granted_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_TeacherEntitlements_GrantedBy REFERENCES dbo.Users(id),
    granted_reason NVARCHAR(255) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_TeacherEntitlements_CreatedAt DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_TeacherEntitlements_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_TeacherEntitlements_Status CHECK (status IN ('none', 'trial', 'active', 'grace_period', 'cancelled', 'expired')),
    CONSTRAINT CK_TeacherEntitlements_Source CHECK (source IN ('comp', 'app_store', 'play_store'))
);
GO

CREATE OR ALTER TRIGGER dbo.TR_TeacherEntitlements_SetUpdatedAt
ON dbo.TeacherEntitlements
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE te
    SET updated_at = SYSUTCDATETIME()
    FROM dbo.TeacherEntitlements te
    INNER JOIN inserted i ON i.teacher_id = te.teacher_id;
END;
GO
