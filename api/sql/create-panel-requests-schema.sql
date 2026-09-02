-- Panel talep sistemi: veli / öğretmen / öğrencinin sistem yöneticilerinden bir şey
-- talep ettiği genel akış. Şimdilik tek tür var: 'kitap-ekleme' (bir kitabın kapak +
-- içindekiler + cevap anahtarı fotoğraflarıyla kütüphaneye eklenmesi talebi). İleride
-- başka talep türleri de aynı tabloya `type` ile eklenecek.
-- bkz. api/src/panelRequests.js

IF OBJECT_ID('dbo.PanelRequests', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PanelRequests (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    type NVARCHAR(40) NOT NULL
      CONSTRAINT CK_PanelRequests_Type CHECK (type IN ('kitap-ekleme')),
    status NVARCHAR(20) NOT NULL
      CONSTRAINT DF_PanelRequests_Status DEFAULT 'beklemede'
      CONSTRAINT CK_PanelRequests_Status CHECK (status IN ('beklemede', 'tamamlandi', 'iptal')),
    payload_json NVARCHAR(MAX) NULL,          -- { bookName, publisherName, subjectId, grade, note }
    admin_note NVARCHAR(1000) NULL,
    created_by_user_id UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT FK_PanelRequests_CreatedBy REFERENCES dbo.Users(id),
    created_by_role NVARCHAR(20) NULL,
    reviewed_by_user_id UNIQUEIDENTIFIER NULL
      CONSTRAINT FK_PanelRequests_ReviewedBy REFERENCES dbo.Users(id),
    reviewed_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_PanelRequests_CreatedAt DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_PanelRequests_UpdatedAt DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX IX_PanelRequests_CreatedBy ON dbo.PanelRequests (created_by_user_id);
  CREATE INDEX IX_PanelRequests_TypeStatus ON dbo.PanelRequests (type, status);
END
GO

IF OBJECT_ID('dbo.PanelRequestPhotos', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PanelRequestPhotos (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    request_id UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT FK_PanelRequestPhotos_RequestId REFERENCES dbo.PanelRequests(id),
    section NVARCHAR(20) NOT NULL
      CONSTRAINT CK_PanelRequestPhotos_Section CHECK (section IN ('kapak', 'icindekiler', 'cevap-anahtari')),
    sort_order INT NOT NULL,
    photo_url NVARCHAR(MAX) NOT NULL,          -- data:image/jpeg;base64,...
    created_at DATETIME2 NOT NULL CONSTRAINT DF_PanelRequestPhotos_CreatedAt DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX IX_PanelRequestPhotos_RequestId ON dbo.PanelRequestPhotos (request_id);
END
GO
