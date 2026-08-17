ALTER TABLE dbo.StudentProfiles ADD gender NVARCHAR(10) NULL
    CONSTRAINT CK_StudentProfiles_Gender CHECK (gender IN (N'kiz', N'erkek'));
GO

-- theme_id değerleri src/theme/themes.js içindeki THEME_IDS listesiyle senkron tutulmalı.
ALTER TABLE dbo.StudentProfiles ADD theme_id NVARCHAR(20) NULL
    CONSTRAINT CK_StudentProfiles_ThemeId CHECK (theme_id IN (N'pink', N'blue', N'neutral', N'purple', N'green', N'orange', N'black'));
GO
