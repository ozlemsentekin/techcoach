CREATE TABLE dbo.RateLimitHits (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    rate_key NVARCHAR(200) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_RateLimitHits_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_RateLimitHits_Key_CreatedAt ON dbo.RateLimitHits (rate_key, created_at DESC);
GO
