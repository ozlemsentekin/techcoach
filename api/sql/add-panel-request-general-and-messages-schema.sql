-- Panel talep sistemi genişletmesi: 'genel' talep türü + talep üzerindeki yazışma /
-- işlem hareketleri (PanelRequestMessages). Talep eden ile yönetici aynı talep
-- üzerinde karşılıklı not yazabilir.
-- bkz. api/src/panelRequests.js, api/sql/create-panel-requests-schema.sql

-- 1) 'genel' türünü CHECK kısıtına ekle.
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_PanelRequests_Type')
  ALTER TABLE dbo.PanelRequests DROP CONSTRAINT CK_PanelRequests_Type;
GO

ALTER TABLE dbo.PanelRequests WITH CHECK
  ADD CONSTRAINT CK_PanelRequests_Type CHECK (type IN ('kitap-ekleme', 'genel'));
GO

-- 2) Talep üzerindeki yazışma / işlem hareketleri.
IF OBJECT_ID('dbo.PanelRequestMessages', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PanelRequestMessages (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    request_id UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT FK_PanelRequestMessages_RequestId REFERENCES dbo.PanelRequests(id),
    author_user_id UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT FK_PanelRequestMessages_AuthorId REFERENCES dbo.Users(id),
    author_role NVARCHAR(20) NULL,            -- 'admin' | 'ebeveyn' | 'ogretmen' | 'ogrenci'
    body NVARCHAR(2000) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_PanelRequestMessages_CreatedAt DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX IX_PanelRequestMessages_RequestId ON dbo.PanelRequestMessages (request_id, created_at);
END
GO
