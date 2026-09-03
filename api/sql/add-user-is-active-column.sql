-- Kullanıcılara (öğretmen/veli/öğrenci/admin) aktif/pasif durumu ekler.
-- Pasif kullanıcı giriş yapamaz; açık oturumu varsa /auth/me ve panel uçları
-- 403 ACCOUNT_DISABLED döner ve istemci oturumu kapatır (kayıt silinmez).
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'is_active'
)
BEGIN
  ALTER TABLE dbo.Users
    ADD is_active BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT 1;
END
GO
