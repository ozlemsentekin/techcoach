-- Bildirim merkezi ilk yayını: deploy anından ÖNCEKI tüm öğrenci işlem kayıtlarını
-- her izleyici (veli / öğretmen) için "okundu" say. Böylece zil, canlıya alındığında
-- geçmiş aktivite selini okunmamış göstermez; sadece bundan sonraki işlemler bildirim olur.
-- Idempotent (NOT EXISTS) + tek seferlik. Cutoff = script çalıştığı an.
DECLARE @cutoff DATETIME2 = SYSUTCDATETIME();

-- Veli: her aktivite × çocuğun bağlı velisi
INSERT INTO dbo.TaskActivityReads (activity_id, user_id)
SELECT l.id, stu.parent_id
FROM dbo.TaskActivityLogs l
INNER JOIN dbo.Users stu ON stu.id = l.student_id
WHERE stu.parent_id IS NOT NULL
  AND l.actor_role = N'ogrenci'
  AND l.action IN (N'task_completed', N'task_partially_completed', N'task_started', N'help_requested')
  AND l.created_at < @cutoff
  AND NOT EXISTS (
    SELECT 1 FROM dbo.TaskActivityReads ar WHERE ar.activity_id = l.id AND ar.user_id = stu.parent_id
  );
GO

-- Öğretmen: kapsamındaki (kendi ilişkisi / takip ettiği kaynak / dersine ait kaynaksız ödev)
-- her aktivite × öğretmen
DECLARE @cutoff2 DATETIME2 = SYSUTCDATETIME();

INSERT INTO dbo.TaskActivityReads (activity_id, user_id)
SELECT DISTINCT l.id, st.teacher_user_id
FROM dbo.TaskActivityLogs l
INNER JOIN dbo.Tasks t ON t.id = l.task_id
INNER JOIN dbo.StudentTeachers st ON st.student_id = l.student_id AND st.is_active = 1
WHERE l.actor_role = N'ogrenci'
  AND l.action IN (N'task_completed', N'task_partially_completed', N'task_started', N'help_requested')
  AND l.created_at < @cutoff2
  AND (
    t.student_teacher_id = st.id
    OR EXISTS (
      SELECT 1 FROM dbo.StudentTeacherResourceBooks strb
      WHERE strb.teacher_id = st.id AND strb.resource_book_id = t.resource_book_id
    )
    OR (
      t.resource_book_id IS NULL
      AND t.subject_id = st.subject_id
      AND t.task_type IN (N'odev', N'soru-bankasi-odevi', N'okul-odevi', N'etkinlik-odevi')
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM dbo.TaskActivityReads ar WHERE ar.activity_id = l.id AND ar.user_id = st.teacher_user_id
  );
GO
