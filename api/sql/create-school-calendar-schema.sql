-- Okul seviyesinde tatil takvimi: resmi tatil / okulun kapalı olduğu gün aralıkları. Öğrencinin
-- haftalık planındaki okul ders saatleri (SchoolClassSchedules şablonu) bu aralıklara denk gelen
-- günlerde gösterilmez ve o günlere görev eklenirken okul çakışması engeli uygulanmaz
-- (bkz. api/src/schoolSchedule.js getPanelSchoolScheduleHandler, src/services/weeklyPlanService.js).
-- v1: entry_type yalnızca 'tatil'. Tek gün için start_date = end_date.
CREATE TABLE dbo.SchoolCalendarEntries (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_SchoolCalendarEntries_Id DEFAULT NEWID() PRIMARY KEY,
    school_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_SchoolCalendarEntries_SchoolId REFERENCES dbo.Schools(id),
    entry_type NVARCHAR(20) NOT NULL CONSTRAINT DF_SchoolCalendarEntries_EntryType DEFAULT 'tatil',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    name NVARCHAR(200) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_SchoolCalendarEntries_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_SchoolCalendarEntries_School_Dates
    ON dbo.SchoolCalendarEntries (school_id, start_date, end_date);
GO
