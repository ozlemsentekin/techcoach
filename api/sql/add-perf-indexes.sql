-- Performance pass for concurrent load: adds indexes for FK/lookup columns that
-- are hit on hot read paths (parent dashboard, homework listing/linking) but
-- were only ever created as plain columns/FKs, forcing table scans as data grows.

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_ParentId' AND object_id = OBJECT_ID('dbo.Users'))
BEGIN
  CREATE INDEX IX_Users_ParentId ON dbo.Users (parent_id) WHERE parent_id IS NOT NULL WITH (ONLINE = ON);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tasks_HomeworkId' AND object_id = OBJECT_ID('dbo.Tasks'))
BEGIN
  CREATE INDEX IX_Tasks_HomeworkId ON dbo.Tasks (homework_id) WHERE homework_id IS NOT NULL WITH (ONLINE = ON);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WrongQuestions_TaskId_TestQuestion' AND object_id = OBJECT_ID('dbo.WrongQuestions'))
BEGIN
  CREATE INDEX IX_WrongQuestions_TaskId_TestQuestion
    ON dbo.WrongQuestions (task_id, test_id, question_number)
    WHERE task_id IS NOT NULL
    WITH (ONLINE = ON);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tasks_StudentDateDraftStart' AND object_id = OBJECT_ID('dbo.Tasks'))
BEGIN
  CREATE INDEX IX_Tasks_StudentDateDraftStart
    ON dbo.Tasks (student_id, date, is_draft, start_time)
    INCLUDE (task_type, status, resource_book_id, homework_id)
    WITH (ONLINE = ON);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tasks_TeacherLessonLookup' AND object_id = OBJECT_ID('dbo.Tasks'))
BEGIN
  CREATE INDEX IX_Tasks_TeacherLessonLookup
    ON dbo.Tasks (student_teacher_id, date, start_time)
    INCLUDE (end_time)
    WHERE student_teacher_id IS NOT NULL AND task_type = 'ders-calisma' AND created_by = 'ogretmen'
    WITH (ONLINE = ON);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_StudentTeachers_TeacherActiveStudent' AND object_id = OBJECT_ID('dbo.StudentTeachers'))
BEGIN
  CREATE INDEX IX_StudentTeachers_TeacherActiveStudent
    ON dbo.StudentTeachers (teacher_user_id, is_active, student_id)
    WITH (ONLINE = ON);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_StudentTeacherResourceBooks_TeacherBook' AND object_id = OBJECT_ID('dbo.StudentTeacherResourceBooks'))
BEGIN
  CREATE INDEX IX_StudentTeacherResourceBooks_TeacherBook
    ON dbo.StudentTeacherResourceBooks (teacher_id, resource_book_id)
    WITH (ONLINE = ON);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ResourceBookTopics_ResourceBook' AND object_id = OBJECT_ID('dbo.ResourceBookTopics'))
BEGIN
  CREATE INDEX IX_ResourceBookTopics_ResourceBook
    ON dbo.ResourceBookTopics (resource_book_id)
    WITH (ONLINE = ON);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ResourceBookTopicTests_Topic' AND object_id = OBJECT_ID('dbo.ResourceBookTopicTests'))
BEGIN
  CREATE INDEX IX_ResourceBookTopicTests_Topic
    ON dbo.ResourceBookTopicTests (topic_id)
    WITH (ONLINE = ON);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_StudentManualTestCompletions_StudentTest' AND object_id = OBJECT_ID('dbo.StudentManualTestCompletions'))
BEGIN
  CREATE INDEX IX_StudentManualTestCompletions_StudentTest
    ON dbo.StudentManualTestCompletions (student_id, test_id)
    INCLUDE (correct_count, wrong_count, blank_count)
    WITH (ONLINE = ON);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CheckIns_StudentDate' AND object_id = OBJECT_ID('dbo.CheckIns'))
BEGIN
  CREATE INDEX IX_CheckIns_StudentDate
    ON dbo.CheckIns (student_id, date)
    WITH (ONLINE = ON);
END
GO
