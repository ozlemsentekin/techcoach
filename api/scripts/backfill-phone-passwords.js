// Şifreli girişe geri dönüşün bir parçası: TÜM mevcut kullanıcıların password_hash'ini
// telefon numarasının son 6 hanesine (yeniden) set eder ve failed_login_count/lockout_until'ü
// sıfırlar. Bu, hesap sahibi ilk girişini (auth/login) yapana kadar geçerli olur — o an
// requiresPasswordChange true döneceğinden giriş SMS koduyla ikinci faktör de isteyecek
// (bkz. auth.js loginHandler) ve zorunlu şifre değiştirmeye yönlendirilecek.
//
// DİKKAT: Bu, prod'daki HERKESİN şifresini aynı anda sıfırlar — elle, açık onayla çalıştırılır,
// otomatik deploy'un bir parçası DEĞİLDİR.
// Kullanım: node api/scripts/backfill-phone-passwords.js
const { sql, withRequest } = require('../src/db')
const { defaultPasswordForPhone, hashPassword } = require('../src/security')

async function main() {
  const db = await withRequest({})
  const result = await db.query(`
    SELECT id, full_name, phone_number FROM dbo.Users WHERE phone_number IS NOT NULL;
  `)

  for (const record of result.recordset) {
    const password = defaultPasswordForPhone(record.phone_number)
    if (password.length !== 6) {
      console.warn(`Atlandı (telefon çok kısa): ${record.full_name} (${record.phone_number})`)
      continue
    }

    const passwordHash = await hashPassword(password)
    const updateDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: record.id },
      passwordHash: { type: sql.NVarChar(255), value: passwordHash },
    })
    await updateDb.query(`
      UPDATE dbo.Users
      SET password_hash = @passwordHash,
          failed_login_count = 0,
          lockout_until = NULL
      WHERE id = @id;
    `)
    console.log(`Güncellendi: ${record.full_name} (${record.phone_number})`)
  }

  console.log(`Toplam ${result.recordset.length} kullanıcı güncellendi.`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('backfill-phone-passwords failed', error)
    process.exit(1)
  })
