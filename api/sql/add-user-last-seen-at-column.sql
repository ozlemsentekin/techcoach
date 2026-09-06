-- Kullanıcının "son işlem" zamanını tutar. last_login_at yalnızca giriş anında
-- güncellenir; last_seen_at ise her yazma işleminde (görev/ders ekleme, düzenleme,
-- silme ve giriş) passwordGate sarmalayıcısı tarafından en fazla 10 dakikada bir
-- güncellenir. Admin "Üyeler" ekranındaki "Son İşlem" kolonu bu alanı gösterir.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'last_seen_at'
)
BEGIN
  ALTER TABLE dbo.Users ADD last_seen_at DATETIME2 NULL;
END
GO

-- Mevcut satırlar için bilinen en iyi değerle (son giriş) doldur.
UPDATE dbo.Users
SET last_seen_at = last_login_at
WHERE last_seen_at IS NULL AND last_login_at IS NOT NULL;
GO
