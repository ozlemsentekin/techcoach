-- Kaynak ekleme ekranlarından "Kaynak Türü" (okul/özel) seçimi kaldırıldı; artık tüm kaynaklar
-- "Özel Kaynak" (ozel) olarak ekleniyor. Mevcut kayıtları da 'ozel' olarak işaretle ve default'u
-- güncelle. Kolon ileride tekrar kullanılabilir diye tabloda bırakıldı.

UPDATE dbo.ResourceBooks SET resource_source = 'ozel' WHERE resource_source <> 'ozel';

ALTER TABLE dbo.ResourceBooks DROP CONSTRAINT DF_ResourceBooks_ResourceSource;
ALTER TABLE dbo.ResourceBooks ADD CONSTRAINT DF_ResourceBooks_ResourceSource DEFAULT 'ozel' FOR resource_source;
GO
