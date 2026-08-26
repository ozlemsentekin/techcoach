-- Kütüphane kaynak sihirbazındaki AI çıkarma işlemlerini (kapak/içindekiler/cevap anahtarı)
-- senkron HTTP isteği yerine arka planda çalıştırıp durumunu sorgulanabilir hale getirmek için.
CREATE TABLE dbo.LibraryExtractionJobs (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    job_type NVARCHAR(20) NOT NULL CONSTRAINT CK_LibraryExtractionJobs_JobType CHECK (job_type IN ('toc', 'cover', 'answer_key')),
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_LibraryExtractionJobs_Status DEFAULT 'pending' CONSTRAINT CK_LibraryExtractionJobs_Status CHECK (status IN ('pending', 'done', 'error')),
    result_json NVARCHAR(MAX) NULL,
    error_message NVARCHAR(500) NULL,
    created_by_user_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_LibraryExtractionJobs_CreatedByUserId REFERENCES dbo.Users(id),
    created_at DATETIME2 NOT NULL CONSTRAINT DF_LibraryExtractionJobs_CreatedAt DEFAULT SYSUTCDATETIME(),
    completed_at DATETIME2 NULL
);
GO

CREATE INDEX IX_LibraryExtractionJobs_CreatedByUserId ON dbo.LibraryExtractionJobs (created_by_user_id);
GO
