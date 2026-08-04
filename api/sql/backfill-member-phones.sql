-- Bu script'i api/sql/add-phone-otp-auth-schema.sql uygulandıktan SONRA, production veritabanında
-- elle çalıştırın. full_name eşleşmezse (isim DB'de farklı yazılmışsa) UPDATE 0 satır etkiler;
-- çalıştırdıktan sonra aşağıdaki SELECT ile doğrulayın.

UPDATE dbo.Users SET phone_number = '+905353816943' WHERE full_name = N'Özlem Şişman';
UPDATE dbo.Users SET phone_number = '+905336916943' WHERE full_name = N'Aylin Şişman';

SELECT full_name, email, phone_number, role
FROM dbo.Users
WHERE full_name IN (N'Özlem Şişman', N'Aylin Şişman');
