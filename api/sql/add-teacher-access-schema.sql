-- Bir veli, "Öğretmenler" sayfasındaki bir öğretmene panel erişimi verdiğinde bu
-- StudentTeachers satırı (ve aynı öğretmene bağlı diğer tüm satırlar) gerçek bir
-- dbo.Users hesabına (role='ogretmen') bağlanır. teacher_user_id NULL ise henüz
-- yetki verilmemiş demektir.
ALTER TABLE dbo.StudentTeachers ADD teacher_user_id UNIQUEIDENTIFIER NULL
    CONSTRAINT FK_StudentTeachers_TeacherUserId REFERENCES dbo.Users(id);
GO

ALTER TABLE dbo.StudentTeachers ADD access_granted_at DATETIME2 NULL;
GO

CREATE INDEX IX_StudentTeachers_TeacherUserId
    ON dbo.StudentTeachers (teacher_user_id)
    WHERE teacher_user_id IS NOT NULL;
GO
