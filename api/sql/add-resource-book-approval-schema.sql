ALTER TABLE dbo.ResourceBooks ADD
  status NVARCHAR(20) NOT NULL CONSTRAINT DF_ResourceBooks_Status DEFAULT 'approved'
    CONSTRAINT CK_ResourceBooks_Status CHECK (status IN ('pending','approved','rejected')),
  created_by_role NVARCHAR(20) NULL
    CONSTRAINT CK_ResourceBooks_CreatedByRole CHECK (created_by_role IN ('admin','ogretmen','ebeveyn')),
  created_by_user_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_ResourceBooks_CreatedByUserId REFERENCES dbo.Users(id),
  reviewed_by_user_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_ResourceBooks_ReviewedByUserId REFERENCES dbo.Users(id),
  reviewed_at DATETIME2 NULL,
  rejection_reason NVARCHAR(500) NULL;
GO
