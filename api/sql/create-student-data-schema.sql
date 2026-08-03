ALTER TABLE dbo.ResourceBooks ADD subject_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_ResourceBooks_SubjectId REFERENCES dbo.Subjects(id);
GO

ALTER TABLE dbo.ResourceBooks ADD is_active BIT NOT NULL CONSTRAINT DF_ResourceBooks_IsActive DEFAULT 1;
GO

CREATE INDEX IX_ResourceBooks_SubjectId ON dbo.ResourceBooks (subject_id);
GO

CREATE TABLE dbo.Homeworks (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    student_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_Homeworks_StudentId REFERENCES dbo.Users(id),
    subject_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_Homeworks_SubjectId REFERENCES dbo.Subjects(id),
    resource_book_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_Homeworks_ResourceBookId REFERENCES dbo.ResourceBooks(id),
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(1000) NULL,
    assigned_date DATE NOT NULL,
    due_date DATE NOT NULL,
    total_question_count INT NOT NULL CONSTRAINT DF_Homeworks_TotalQuestionCount DEFAULT 0,
    completed_question_count INT NOT NULL CONSTRAINT DF_Homeworks_CompletedQuestionCount DEFAULT 0,
    priority NVARCHAR(20) NOT NULL CONSTRAINT DF_Homeworks_Priority DEFAULT N'orta',
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_Homeworks_Status DEFAULT N'bekliyor',
    is_split BIT NOT NULL CONSTRAINT DF_Homeworks_IsSplit DEFAULT 0,
    day_plans_json NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_Homeworks_CreatedAt DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_Homeworks_UpdatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_Homeworks_StudentId ON dbo.Homeworks (student_id);
GO

CREATE OR ALTER TRIGGER dbo.TR_Homeworks_SetUpdatedAt
ON dbo.Homeworks
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE h
    SET updated_at = SYSUTCDATETIME()
    FROM dbo.Homeworks h
    INNER JOIN inserted i ON i.id = h.id;
END;
GO

CREATE TABLE dbo.Tasks (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    student_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_Tasks_StudentId REFERENCES dbo.Users(id),
    is_draft BIT NOT NULL CONSTRAINT DF_Tasks_IsDraft DEFAULT 0,
    date DATE NOT NULL,
    title NVARCHAR(200) NOT NULL,
    task_type NVARCHAR(40) NOT NULL,
    subject NVARCHAR(100) NULL,
    topic NVARCHAR(200) NULL,
    start_time CHAR(5) NOT NULL,
    end_time CHAR(5) NOT NULL,
    duration_minutes INT NOT NULL,
    timer_started_at DATETIME2 NULL,
    timer_stopped_at DATETIME2 NULL,
    timer_elapsed_seconds INT NULL,
    target_question_count INT NULL,
    completed_question_count INT NULL,
    priority NVARCHAR(20) NOT NULL CONSTRAINT DF_Tasks_Priority DEFAULT N'orta',
    status NVARCHAR(30) NOT NULL CONSTRAINT DF_Tasks_Status DEFAULT N'bekliyor',
    description NVARCHAR(1000) NULL,
    parent_note NVARCHAR(1000) NULL,
    created_by NVARCHAR(20) NOT NULL CONSTRAINT DF_Tasks_CreatedBy DEFAULT N'ebeveyn',
    notes NVARCHAR(1000) NULL,
    completed_at DATETIME2 NULL,
    rescheduled_from NVARCHAR(50) NULL,
    rescheduled_to NVARCHAR(50) NULL,
    reschedule_reason NVARCHAR(500) NULL,
    correct_count INT NULL,
    wrong_count INT NULL,
    blank_count INT NULL,
    difficulty NVARCHAR(30) NULL,
    emotion NVARCHAR(30) NULL,
    reflection_answers_json NVARCHAR(MAX) NULL,
    completed_sub_goals_json NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_Tasks_CreatedAt DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_Tasks_UpdatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_Tasks_StudentId_Date ON dbo.Tasks (student_id, date, is_draft);
GO

CREATE OR ALTER TRIGGER dbo.TR_Tasks_SetUpdatedAt
ON dbo.Tasks
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE t
    SET updated_at = SYSUTCDATETIME()
    FROM dbo.Tasks t
    INNER JOIN inserted i ON i.id = t.id;
END;
GO

CREATE TABLE dbo.WeeklyPlanStatuses (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    student_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_WeeklyPlanStatuses_StudentId REFERENCES dbo.Users(id),
    week_start_date DATE NOT NULL,
    status NVARCHAR(20) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_WeeklyPlanStatuses_CreatedAt DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_WeeklyPlanStatuses_UpdatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_WeeklyPlanStatuses_StudentId_WeekStart ON dbo.WeeklyPlanStatuses (student_id, week_start_date);
GO

CREATE OR ALTER TRIGGER dbo.TR_WeeklyPlanStatuses_SetUpdatedAt
ON dbo.WeeklyPlanStatuses
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE w
    SET updated_at = SYSUTCDATETIME()
    FROM dbo.WeeklyPlanStatuses w
    INNER JOIN inserted i ON i.id = w.id;
END;
GO

CREATE TABLE dbo.Messages (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    student_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_Messages_StudentId REFERENCES dbo.Users(id),
    from_role NVARCHAR(20) NOT NULL,
    text NVARCHAR(2000) NOT NULL,
    read_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_Messages_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_Messages_StudentId ON dbo.Messages (student_id);
GO

CREATE TABLE dbo.CoachNotes (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    student_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_CoachNotes_StudentId REFERENCES dbo.Users(id),
    text NVARCHAR(1000) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_CoachNotes_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_CoachNotes_StudentId ON dbo.CoachNotes (student_id);
GO

CREATE TABLE dbo.StudentRequests (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    student_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_StudentRequests_StudentId REFERENCES dbo.Users(id),
    type NVARCHAR(30) NOT NULL,
    message NVARCHAR(1000) NOT NULL,
    proposed_date DATE NULL,
    proposed_time CHAR(5) NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_StudentRequests_Status DEFAULT N'bekliyor',
    created_at DATETIME2 NOT NULL CONSTRAINT DF_StudentRequests_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_StudentRequests_StudentId ON dbo.StudentRequests (student_id);
GO

CREATE TABLE dbo.CheckIns (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    student_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_CheckIns_StudentId REFERENCES dbo.Users(id),
    date DATE NOT NULL,
    energy_level NVARCHAR(30) NOT NULL,
    note NVARCHAR(500) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_CheckIns_CreatedAt DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_CheckIns_UpdatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_CheckIns_StudentId_Date ON dbo.CheckIns (student_id, date);
GO

CREATE OR ALTER TRIGGER dbo.TR_CheckIns_SetUpdatedAt
ON dbo.CheckIns
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE c
    SET updated_at = SYSUTCDATETIME()
    FROM dbo.CheckIns c
    INNER JOIN inserted i ON i.id = c.id;
END;
GO

CREATE TABLE dbo.WrongQuestions (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    student_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_WrongQuestions_StudentId REFERENCES dbo.Users(id),
    task_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_WrongQuestions_TaskId REFERENCES dbo.Tasks(id),
    subject NVARCHAR(100) NOT NULL,
    topic NVARCHAR(200) NULL,
    question_number NVARCHAR(20) NULL,
    error_type NVARCHAR(50) NOT NULL,
    student_note NVARCHAR(1000) NULL,
    review_status NVARCHAR(30) NOT NULL CONSTRAINT DF_WrongQuestions_ReviewStatus DEFAULT N'tekrar-bekliyor',
    resolved_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_WrongQuestions_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_WrongQuestions_StudentId ON dbo.WrongQuestions (student_id);
GO

CREATE TABLE dbo.StudySessions (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    student_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_StudySessions_StudentId REFERENCES dbo.Users(id),
    task_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_StudySessions_TaskId REFERENCES dbo.Tasks(id),
    started_at DATETIME2 NOT NULL,
    ended_at DATETIME2 NOT NULL,
    duration_minutes INT NOT NULL,
    completed_question_count INT NOT NULL CONSTRAINT DF_StudySessions_CompletedQuestionCount DEFAULT 0,
    correct_count INT NULL,
    wrong_count INT NULL,
    blank_count INT NULL,
    difficulty_rating NVARCHAR(30) NULL,
    emotion NVARCHAR(30) NULL,
    note NVARCHAR(1000) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_StudySessions_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_StudySessions_StudentId ON dbo.StudySessions (student_id);
GO

CREATE TABLE dbo.ParentMotivationMessages (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    student_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_ParentMotivationMessages_StudentId REFERENCES dbo.Users(id),
    title NVARCHAR(200) NULL,
    body NVARCHAR(1000) NOT NULL,
    display_date DATE NOT NULL,
    expires_at DATETIME2 NULL,
    priority NVARCHAR(20) NOT NULL CONSTRAINT DF_ParentMotivationMessages_Priority DEFAULT N'normal',
    is_active BIT NOT NULL CONSTRAINT DF_ParentMotivationMessages_IsActive DEFAULT 1,
    linked_task_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_ParentMotivationMessages_LinkedTaskId REFERENCES dbo.Tasks(id),
    read_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_ParentMotivationMessages_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_ParentMotivationMessages_StudentId_DisplayDate ON dbo.ParentMotivationMessages (student_id, display_date);
GO

CREATE TABLE dbo.MotivationFeedback (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    student_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_MotivationFeedback_StudentId REFERENCES dbo.Users(id),
    message_id NVARCHAR(100) NOT NULL,
    reaction NVARCHAR(30) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_MotivationFeedback_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_MotivationFeedback_StudentId ON dbo.MotivationFeedback (student_id);
GO

CREATE TABLE dbo.MotivationDailySelections (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    student_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_MotivationDailySelections_StudentId REFERENCES dbo.Users(id),
    date DATE NOT NULL,
    message_id NVARCHAR(100) NULL,
    category NVARCHAR(50) NULL,
    source NVARCHAR(20) NULL,
    switch_count INT NOT NULL CONSTRAINT DF_MotivationDailySelections_SwitchCount DEFAULT 0,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_MotivationDailySelections_CreatedAt DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_MotivationDailySelections_UpdatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_MotivationDailySelections_StudentId_Date ON dbo.MotivationDailySelections (student_id, date);
GO

CREATE OR ALTER TRIGGER dbo.TR_MotivationDailySelections_SetUpdatedAt
ON dbo.MotivationDailySelections
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE m
    SET updated_at = SYSUTCDATETIME()
    FROM dbo.MotivationDailySelections m
    INNER JOIN inserted i ON i.id = m.id;
END;
GO

ALTER TABLE dbo.Users ADD small_goal NVARCHAR(500) NULL;
GO
