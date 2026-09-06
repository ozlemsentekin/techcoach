-- iyzico abonelik checkout oturumları: initiate anında iyzico'nun döndürdüğü checkout form
-- token'ını, ödeme onaylanınca hangi kullanıcı/akış için olduğunu bilmek üzere saklarız.
--
-- Neden gerekli: iyzico'nun abonelik checkout formu "retrieve" yanıtı conversationId DÖNMÜYOR
-- (iyzico'nun bilinen hatası, iyzipay-php#194). Bu yüzden iyzicoCheckoutCallbackHandler ödemeyi
-- kullanıcıyla eşleştiremiyor, kartı çekilse bile abonelik uygulamaya kaydedilmiyordu.
-- Callback token'ı her zaman geri alıyor; conversationId'yi artık bu tablodan çözüyoruz.
--
-- Idempotent — tekrar çalıştırılabilir.
IF OBJECT_ID('dbo.IyzicoCheckoutSessions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.IyzicoCheckoutSessions (
        token NVARCHAR(100) NOT NULL PRIMARY KEY,
        plan_kind NVARCHAR(20) NOT NULL,
        -- Mevcut bir Users.id (parent / childSeat / teacherSeat) veya bir
        -- PendingParentRegistrations.id (parentNew).
        conversation_id NVARCHAR(120) NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_IyzicoCheckoutSessions_CreatedAt DEFAULT SYSUTCDATETIME(),
        consumed_at DATETIME2 NULL,
        CONSTRAINT CK_IyzicoCheckoutSessions_PlanKind
            CHECK (plan_kind IN ('parent', 'parentNew', 'childSeat', 'teacherSeat'))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_IyzicoCheckoutSessions_CreatedAt' AND object_id = OBJECT_ID('dbo.IyzicoCheckoutSessions'))
    CREATE INDEX IX_IyzicoCheckoutSessions_CreatedAt ON dbo.IyzicoCheckoutSessions (created_at);
GO
