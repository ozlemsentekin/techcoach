-- Öğretmenin öğrenci eklemeden de kütüphanesine sınıf ekleyebilmesi için: bir öğretmen
-- burada elle bir sınıf ekleyince, o öğrencisi olmasa da kütüphanede o sınıf görünür.
-- Kütüphane sayfasında gösterilen sınıf listesi bu tablo ile öğrencilerin sınıflarının
-- birleşimidir (bkz. api/src/teacher.js listTeacherLibraryGradesHandler).
CREATE TABLE dbo.TeacherLibraryGrades (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_TeacherLibraryGrades_Id DEFAULT NEWID() PRIMARY KEY,
    teacher_user_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_TeacherLibraryGrades_TeacherUserId REFERENCES dbo.Users(id),
    grade NVARCHAR(20) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_TeacherLibraryGrades_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_TeacherLibraryGrades_TeacherGrade
    ON dbo.TeacherLibraryGrades (teacher_user_id, grade);
GO
