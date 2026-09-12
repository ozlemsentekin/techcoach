IF OBJECT_ID('dbo.LessonNotes', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.LessonNotes (
    id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    grade NVARCHAR(20) NOT NULL,
    subject_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.Subjects(id),
    title NVARCHAR(200) NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    topics_json NVARCHAR(MAX) NOT NULL,
    images_json NVARCHAR(MAX) NOT NULL,
    CONSTRAINT CK_LessonNotes_dates CHECK (week_end >= week_start),
    CONSTRAINT CK_LessonNotes_json CHECK (ISJSON(topics_json) = 1 AND ISJSON(images_json) = 1)
  );
  CREATE INDEX IX_LessonNotes_grade_subject ON dbo.LessonNotes(grade, subject_id, week_start);
END;
