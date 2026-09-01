// password_hash'i NULL olan (ama telefonu dolu) kullanıcılara varsayılan şifreyi
// (telefon numarasının son 6 hanesi) atar. Yalnızca NULL olanlara dokunur —
// mevcut/özelleştirilmiş şifreleri EZMEZ. Öğretmenin "öğrenci ekle" akışıyla
// oluşan ve şifresi hiç set edilmemiş kayıtları düzeltmek için.
const fs = require('fs')
const path = require('path')
const sql = require('mssql')
const bcrypt = require('bcryptjs')

const parsed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'local.settings.json'), 'utf8'))
Object.entries(parsed.Values || {}).forEach(([k, v]) => {
  if (!process.env[k] && typeof v === 'string') process.env[k] = v
})

function defaultPasswordForPhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-6)
}

async function main() {
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const result = await pool.request().query(`
      SELECT id, full_name, phone_number, role
      FROM dbo.Users
      WHERE password_hash IS NULL AND phone_number IS NOT NULL;
    `)

    console.log(`${result.recordset.length} kayıt bulundu.`)
    for (const u of result.recordset) {
      const pw = defaultPasswordForPhone(u.phone_number)
      if (pw.length !== 6) {
        console.warn(`  ATLANDI (telefon kısa): ${u.full_name} (${u.phone_number})`)
        continue
      }
      const hash = bcrypt.hashSync(pw, 10)
      await pool.request()
        .input('id', sql.UniqueIdentifier, u.id)
        .input('hash', sql.NVarChar(255), hash)
        .query('UPDATE dbo.Users SET password_hash = @hash WHERE id = @id AND password_hash IS NULL;')
      console.log(`  OK: ${u.full_name} (${u.role}, ${u.phone_number}) -> şifre ${pw}`)
    }
  } finally {
    await pool.close()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
