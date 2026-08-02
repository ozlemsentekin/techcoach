-- Links dbo.Tasks rows back to the dbo.Homeworks row they were generated from,
-- so completing a task (question answers, reading progress, manual "done")
-- can write the real completion state back onto the homework instead of it
-- staying frozen at its assignment-time value.
IF COL_LENGTH('dbo.Tasks', 'homework_id') IS NULL
BEGIN
  ALTER TABLE dbo.Tasks ADD homework_id UNIQUEIDENTIFIER NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Tasks_Homeworks')
BEGIN
  ALTER TABLE dbo.Tasks
    ADD CONSTRAINT FK_Tasks_Homeworks FOREIGN KEY (homework_id)
    REFERENCES dbo.Homeworks(id) ON DELETE SET NULL;
END
GO

-- Backfill: link existing 'odev' tasks to the homework they were created from.
-- createTaskForHomework always sets task.date = homework.due_date and
-- task.description = homework.title, so that pair is the natural match key.
UPDATE t
SET t.homework_id = h.id
FROM dbo.Tasks t
INNER JOIN dbo.Homeworks h
  ON h.student_id = t.student_id
  AND h.due_date = t.date
  AND h.title = t.description
WHERE t.task_type = 'odev' AND t.homework_id IS NULL;
GO

-- Copy each linked task's current completion state onto its homework so
-- already-completed homeworks show correctly right away, without waiting
-- for the next task update.
UPDATE h
SET h.completed_question_count = t.completed_question_count,
    h.status = t.status
FROM dbo.Homeworks h
INNER JOIN dbo.Tasks t ON t.homework_id = h.id;
GO
