-- Göreve birden fazla dosya eki (resim veya PDF). Liste JSON olarak saklanır:
-- [{ "url": "data:...;base64,...", "name": "dosya.pdf" }]. Eski tek ek kolonları
-- (attachment_url / attachment_name) geriye dönük okunur; görev yeniden kaydedilince
-- ek bu kolona taşınır ve eski kolonlar boşaltılır (bkz. api/src/tasks.js readTaskAttachments).
IF COL_LENGTH('dbo.Tasks', 'attachments_json') IS NULL
BEGIN
    ALTER TABLE dbo.Tasks ADD attachments_json NVARCHAR(MAX) NULL;
END;
GO
