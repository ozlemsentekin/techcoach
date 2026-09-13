-- "İçerik ve cevap anahtarı oluşturmayacağım" (basit kitap) modu: bir kaynak kitap ya
-- konu/test/cevap anahtarı ile tam donatılmış olarak (content_mode = 'structured', varsayılan
-- ve mevcut tüm kitaplar) ya da sadece ad/ders/sınıf bilgisiyle, hiç içerik girilmeden
-- (content_mode = 'simple') kullanılabilir. 'simple' kitaplara görev doğrudan kitap üzerinden
-- verilir (test seçimi yok) ve öğrenci sonucu elle (doğru/yanlış/boş) girer.
-- bkz. api/src/bookshelf.js (createBookHandler/updateBookHandler/validateBookPayload),
-- api/src/catalog.js (listResourceBooksForPanelHandler).

IF COL_LENGTH('dbo.ResourceBooks', 'content_mode') IS NULL
BEGIN
  ALTER TABLE dbo.ResourceBooks ADD
    content_mode NVARCHAR(20) NOT NULL
      CONSTRAINT DF_ResourceBooks_ContentMode DEFAULT 'structured'
      CONSTRAINT CK_ResourceBooks_ContentMode CHECK (content_mode IN ('structured','simple'));
END
GO
