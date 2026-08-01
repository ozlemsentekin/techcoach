ALTER TABLE dbo.ResourceBooks ADD has_answer_key BIT NOT NULL
    CONSTRAINT DF_ResourceBooks_HasAnswerKey DEFAULT 1;
GO
