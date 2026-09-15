-- Talep bildirimleri: bir talebe mesaj eklendiğinde veya admin durum değiştirdiğinde
-- karşı tarafa bildirim düşer. recipient_user_id NULL = tüm adminlere yayın (herhangi
-- bir admin okuyunca kendi PanelRequestNotificationReads satırı yazılır).
-- bkz. api/src/panelRequests.js, api/src/notifications.js

IF OBJECT_ID('dbo.PanelRequestNotifications', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PanelRequestNotifications (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    request_id UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT FK_PanelRequestNotifications_RequestId REFERENCES dbo.PanelRequests(id),
    recipient_user_id UNIQUEIDENTIFIER NULL
      CONSTRAINT FK_PanelRequestNotifications_RecipientId REFERENCES dbo.Users(id),
    type NVARCHAR(30) NOT NULL,              -- 'new_message' | 'status_changed'
    from_admin BIT NOT NULL CONSTRAINT DF_PanelRequestNotifications_FromAdmin DEFAULT 0,
    actor_name NVARCHAR(200) NULL,
    body_snippet NVARCHAR(300) NULL,
    status NVARCHAR(20) NULL,                -- yalnızca 'status_changed' için
    created_at DATETIME2 NOT NULL CONSTRAINT DF_PanelRequestNotifications_CreatedAt DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX IX_PanelRequestNotifications_Recipient ON dbo.PanelRequestNotifications (recipient_user_id, created_at);
  CREATE INDEX IX_PanelRequestNotifications_Request ON dbo.PanelRequestNotifications (request_id);
END
GO

IF OBJECT_ID('dbo.PanelRequestNotificationReads', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PanelRequestNotificationReads (
    notification_id UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT FK_PanelRequestNotificationReads_NotificationId REFERENCES dbo.PanelRequestNotifications(id),
    user_id UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT FK_PanelRequestNotificationReads_UserId REFERENCES dbo.Users(id),
    read_at DATETIME2 NOT NULL CONSTRAINT DF_PanelRequestNotificationReads_ReadAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_PanelRequestNotificationReads PRIMARY KEY (notification_id, user_id)
  );
END
GO
