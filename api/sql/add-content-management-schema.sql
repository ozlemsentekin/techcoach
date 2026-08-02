-- Admin-managed content: motivation message pool (system messages shown on the
-- student welcome banner) and greeting rules (time-of-day greeting text).
-- Replaces the previously hardcoded src/data/motivationMessages.js and
-- getGreetingByHour() in src/utils/time.js.

CREATE TABLE dbo.MotivationMessagePool (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    category NVARCHAR(50) NOT NULL
        CONSTRAINT CK_MotivationMessagePool_Category CHECK (category IN (
            'general', 'low_energy', 'high_stress', 'start_easy',
            'task_started', 'partial_completion', 'strong_progress', 'completed_day')),
    title NVARCHAR(200) NOT NULL,
    body NVARCHAR(500) NOT NULL,
    is_active BIT NOT NULL CONSTRAINT DF_MotivationMessagePool_IsActive DEFAULT 1,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_MotivationMessagePool_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_MotivationMessagePool_Category ON dbo.MotivationMessagePool (category);
GO

CREATE TABLE dbo.GreetingRules (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    label NVARCHAR(50) NOT NULL,
    end_hour INT NOT NULL CONSTRAINT CK_GreetingRules_EndHour CHECK (end_hour BETWEEN 1 AND 24),
    created_at DATETIME2 NOT NULL CONSTRAINT DF_GreetingRules_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

-- Seed: existing static content, preserved so nothing is lost when the
-- static file/function is removed from the codebase.

INSERT INTO dbo.MotivationMessagePool (category, title, body) VALUES
    (N'general', N'Küçük adımlar büyük hedeflere ulaştırır.', N'Bugün attığın her adım, yarınki başarını inşa eder.'),
    (N'low_energy', N'Bugün daha yumuşak ilerleyebilirsin.', N'Küçük bir görevle başlamak da ilerlemenin bir parçasıdır.'),
    (N'low_energy', N'Enerjin düşük olabilir, emeğin hâlâ değerli.', N'Önce kolay bir adım seç, sonra nasıl hissettiğine yeniden bak.'),
    (N'high_stress', N'Her şeyi şu anda bitirmek zorunda değilsin.', N'Bir nefes al ve yalnızca sıradaki küçük adıma odaklan.'),
    (N'high_stress', N'Zorlanman, yapamayacağın anlamına gelmez.', N'Planı küçültmek ve mola vermek de doğru bir seçimdir.'),
    (N'start_easy', N'Bugün attığın her adım, seni hedefindeki liseye yaklaştırıyor.', N'Mükemmel olmak zorunda değilsin; sadece başlayıp devam etmen yeterli.'),
    (N'task_started', N'Başlamak en önemli adımdı.', N'Şimdi sadece önündeki kısa çalışma süresine odaklan.'),
    (N'partial_completion', N'Tamamladığın bölüm de değerlidir.', N'Kalan kısmı başka bir zamana planlamak başarısızlık değildir.'),
    (N'strong_progress', N'Bugün güzel bir ritim yakaladın.', N'Molalarını koruyarak aynı dengede devam edebilirsin.'),
    (N'completed_day', N'Bugünün planını tamamladın.', N'Şimdi emeğini fark etme ve dinlenme zamanı.');
GO

INSERT INTO dbo.GreetingRules (label, end_hour) VALUES
    (N'Günaydın', 12),
    (N'Tünaydın', 17),
    (N'İyi akşamlar', 24);
GO
