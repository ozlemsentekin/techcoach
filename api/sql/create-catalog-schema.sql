CREATE TABLE dbo.Subjects (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(100) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_Subjects_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_Subjects_Name ON dbo.Subjects (name);
GO

INSERT INTO dbo.Subjects (name) VALUES
    (N'Türkçe'),
    (N'Matematik'),
    (N'Fen Bilimleri'),
    (N'İnkılap Tarihi ve Atatürkçülük'),
    (N'İngilizce');
GO

CREATE TABLE dbo.Publishers (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(150) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_Publishers_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_Publishers_Name ON dbo.Publishers (name);
GO

CREATE TABLE dbo.ResourceBooks (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    publisher_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_ResourceBooks_PublisherId REFERENCES dbo.Publishers(id),
    name NVARCHAR(200) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_ResourceBooks_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_ResourceBooks_PublisherId ON dbo.ResourceBooks (publisher_id);
GO

CREATE TABLE dbo.ResourceBookTopics (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    resource_book_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_ResourceBookTopics_ResourceBookId REFERENCES dbo.ResourceBooks(id),
    name NVARCHAR(200) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_ResourceBookTopics_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_ResourceBookTopics_ResourceBookId ON dbo.ResourceBookTopics (resource_book_id);
GO

CREATE TABLE dbo.ResourceBookTopicTests (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    topic_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_ResourceBookTopicTests_TopicId REFERENCES dbo.ResourceBookTopics(id),
    topic_name NVARCHAR(200) NULL,
    name NVARCHAR(200) NOT NULL,
    page_start INT NULL,
    page_end INT NULL,
    page_count INT NOT NULL CONSTRAINT CK_ResourceBookTopicTests_PageCount CHECK (page_count > 0),
    question_count INT NOT NULL CONSTRAINT CK_ResourceBookTopicTests_QuestionCount CHECK (question_count > 0),
    created_at DATETIME2 NOT NULL CONSTRAINT DF_ResourceBookTopicTests_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_ResourceBookTopicTests_TopicId ON dbo.ResourceBookTopicTests (topic_id);
GO
