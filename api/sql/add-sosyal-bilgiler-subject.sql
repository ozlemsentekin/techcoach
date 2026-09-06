-- "Sosyal Bilgiler" dersini ekler (5-6-7. sınıf). İdempotent: zaten varsa sadece sınıf bilgisini günceller.
IF NOT EXISTS (SELECT 1 FROM dbo.Subjects WHERE name = N'Sosyal Bilgiler')
  INSERT INTO dbo.Subjects (name, is_active, grades_json) VALUES (N'Sosyal Bilgiler', 1, N'["5","6","7"]');
ELSE
  UPDATE dbo.Subjects SET is_active = 1, grades_json = N'["5","6","7"]' WHERE name = N'Sosyal Bilgiler';
GO
