-- 'sinav' gibi saat aralığı taşıyan yeni entry_type değerleri için (bkz. dbo.SchoolCalendarEntries,
-- entry_type önceden yalnızca 'tatil' idi ve saat bilgisi yoktu). 'tatil' kayıtlarında NULL kalır.
ALTER TABLE dbo.SchoolCalendarEntries ADD start_time NVARCHAR(5) NULL;
GO
ALTER TABLE dbo.SchoolCalendarEntries ADD end_time NVARCHAR(5) NULL;
GO
