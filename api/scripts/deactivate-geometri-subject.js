// Geometri dersini pasife alır (dbo.Subjects.is_active = 0), böylece Ders Notları
// sekmelerinden ve panel genelindeki ders seçicilerinden kaybolur.
// İdempotent: zaten pasifse dokunmaz.
const { withRequest } = require('../src/db')

async function main() {
  const db = await withRequest({})
  const before = await db.query(`
    SELECT id, name, is_active FROM dbo.Subjects WHERE name = N'Geometri';
  `)
  const row = before.recordset[0]
  if (!row) {
    throw new Error('Geometri dersi bulunamadı.')
  }
  if (row.is_active === false || row.is_active === 0) {
    console.log('Geometri zaten pasif, dokunulmadı:', row)
    return
  }

  const updateDb = await withRequest({})
  await updateDb.query(`
    UPDATE dbo.Subjects SET is_active = 0 WHERE name = N'Geometri';
  `)
  console.log('Geometri dersi pasife alındı:', row)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
