-- Ödev/Görev tekilleştirme — Faz 1.
-- "Ödev" artık ayrı bir dbo.Homeworks satırı değil, ders-tipi bir dbo.Tasks satırının
-- kendisi. Bu migration yalnızca dbo.Tasks'a kolon ekler + backfill yapar; dbo.Homeworks
-- satırlarına DOKUNMAZ (geri dönüş güvenliği). Tablo Faz 3'te düşürülecek.
--
-- Not: canlı veride 18 Homeworks satırının tamamının bağlı bir Task'ı var, bu yüzden
-- "atanmamış ödev" için yeni Task oluşturmaya gerek yok — sadece backfill.

-- 1) Yeni kolonlar ---------------------------------------------------------------

IF COL_LENGTH('dbo.Tasks', 'is_unscheduled') IS NULL
BEGIN
  ALTER TABLE dbo.Tasks ADD is_unscheduled BIT NOT NULL CONSTRAINT DF_Tasks_IsUnscheduled DEFAULT 0;
END
GO

IF COL_LENGTH('dbo.Tasks', 'subject_id') IS NULL
BEGIN
  ALTER TABLE dbo.Tasks ADD subject_id UNIQUEIDENTIFIER NULL
    CONSTRAINT FK_Tasks_SubjectId REFERENCES dbo.Subjects(id);
END
GO

IF COL_LENGTH('dbo.Tasks', 'assigned_date') IS NULL
BEGIN
  ALTER TABLE dbo.Tasks ADD assigned_date DATE NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tasks_StudentId_SubjectId_TaskType' AND object_id = OBJECT_ID('dbo.Tasks'))
BEGIN
  CREATE INDEX IX_Tasks_StudentId_SubjectId_TaskType
    ON dbo.Tasks (student_id, subject_id, task_type)
    WHERE is_draft = 0;
END
GO

-- 2) Backfill: subject_id ------------------------------------------------------

-- 2a) Bağlı ödevden
UPDATE t
SET t.subject_id = h.subject_id
FROM dbo.Tasks t
INNER JOIN dbo.Homeworks h ON h.id = t.homework_id
WHERE t.subject_id IS NULL AND h.subject_id IS NOT NULL;
GO

-- 2b) Ders adı eşleşmesinden (bağlı ödevi olmayan ödev-tipi görevler:
--     AddTaskDrawer 'soru-bankasi-odevi', "Geçen haftayı kopyala" çoğaltmaları)
UPDATE t
SET t.subject_id = s.id
FROM dbo.Tasks t
INNER JOIN dbo.Subjects s ON s.name = t.subject
WHERE t.subject_id IS NULL
  AND t.task_type IN ('odev', 'soru-bankasi-odevi', 'okul-odevi', 'etkinlik-odevi');
GO

-- 3) Backfill: assigned_date --------------------------------------------------

-- 3a) Bağlı ödevden
UPDATE t
SET t.assigned_date = h.assigned_date
FROM dbo.Tasks t
INNER JOIN dbo.Homeworks h ON h.id = t.homework_id
WHERE t.assigned_date IS NULL AND h.assigned_date IS NOT NULL;
GO

-- 3b) Kalanlar için görevin oluşturulma günü
UPDATE dbo.Tasks
SET assigned_date = CAST(created_at AS DATE)
WHERE assigned_date IS NULL
  AND task_type IN ('odev', 'soru-bankasi-odevi', 'okul-odevi', 'etkinlik-odevi');
GO
