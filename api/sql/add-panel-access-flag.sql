-- Şifreli girişten SMS OTP-only girişe geçiş: password_hash artık "bu hesabın panele
-- bağımsız erişimi var mı" iş mantığı bayrağı olarak da kullanılıyordu (bkz. teacher.js
-- grantParentAccessHandler, öğrenci ekleme akışları). Şifre kalkınca bu anlamı taşıyacak
-- ayrı bir sütun gerekiyor. Mevcut password_hash IS NOT NULL durumunu birebir korur.
ALTER TABLE dbo.Users ADD has_panel_access BIT NOT NULL CONSTRAINT DF_Users_HasPanelAccess DEFAULT 0;
GO

UPDATE dbo.Users SET has_panel_access = 1 WHERE password_hash IS NOT NULL;
GO

-- password_hash/failed_login_count/lockout_until sütunları kasıtlı olarak DROP edilmiyor
-- (artık yazılmıyor/okunmuyor, ileride ayrı bir temizlik migration'ında düşürülebilir).

-- PendingParentRegistrations.password_hash iyzico yeni-veli checkout akışında artık hiç
-- üretilmiyor (bkz. payments.js) — NOT NULL kısıtı bu yüzden kaldırılıyor.
ALTER TABLE dbo.PendingParentRegistrations ALTER COLUMN password_hash NVARCHAR(255) NULL;
GO
