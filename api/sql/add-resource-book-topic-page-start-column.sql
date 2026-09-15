-- İçindekiler tanımlarken (ResourceBookTopics) sayfa başlangıç numarası da girilebilsin diye.
-- Testlerin sayfasından bağımsız, konunun/ünitenin kitaptaki gerçek başlangıç sayfası.

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.ResourceBookTopics') AND name = 'page_start'
)
BEGIN
  ALTER TABLE dbo.ResourceBookTopics ADD page_start INT NULL;
END
GO
