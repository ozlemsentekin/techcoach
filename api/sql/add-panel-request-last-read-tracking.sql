-- Talep listesinde "yeni yanıt" rozeti gösterebilmek için her tarafın (talep sahibi /
-- yönetici) yazışmayı en son ne zaman görüntülediğini tutar.
-- bkz. api/src/panelRequests.js

IF COL_LENGTH('dbo.PanelRequests', 'requester_last_read_at') IS NULL
  ALTER TABLE dbo.PanelRequests ADD requester_last_read_at DATETIME2 NULL;
GO

IF COL_LENGTH('dbo.PanelRequests', 'admin_last_read_at') IS NULL
  ALTER TABLE dbo.PanelRequests ADD admin_last_read_at DATETIME2 NULL;
GO
