// Din Kültürü 8 ders notları (Bilfen haftalık notlar) — görseller sayfa sırasıyla verilir.
// Usage: node api/scripts/seed-lesson-notes-din8.js <noteKey> <page1.png> [page2.png ...]
// Idempotent: same title + week already present → its topics/images are replaced.
const fs = require('fs')
const path = require('path')
const sql = require('mssql')
const { validateNote } = require('../src/lessonNotes')

const localSettingsPath = path.join(__dirname, '..', 'local.settings.json')

function loadLocalSettings() {
  if (!fs.existsSync(localSettingsPath)) return
  const parsed = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([key, value]) => {
    if (!process.env[key] && typeof value === 'string') process.env[key] = value
  })
}

const NOTES = {
  'kader-kavramlar': {
    title: 'Kader ile İlgili Kavramlar',
    weekStart: '2026-09-28',
    weekEnd: '2026-10-02',
    topics: [
      'Ömür ve Ecel',
      'Emek ve Rızık',
      'Tevekkül',
      'Başarı ve Başarısızlık',
      'Sağlık ve Hastalık',
      'Kader ile İlgili Kavramların Ayet İncelemesi',
    ],
  },
  'hz-musa-kissasi': {
    title: 'Hz. Musa (a.s.) Kıssası',
    weekStart: '2026-10-05',
    weekEnd: '2026-10-09',
    topics: [
      'Hz. Musa (a.s.) Hakkında Genel Bilgiler',
      'Firavun’un Zulmü',
      'Nil Nehri ve Saray',
      'Hz. Musa’nın Medyen’e Gidişi',
      'Mısır’a Geri Dönüşü ve Peygamberlik Verilmesi',
      'Firavun’a Tebliğ ve Mucize Talebi',
      'Sihirbazlarla Karşılaşma ve Asa Mucizesi',
      'Mucizeler ve İnkârın Sürmesi',
      'Mısır’dan Ayrılış ve Kızıldeniz Mucizesi',
      'Hz. Musa’ya Tevrat’ın Verilmesi',
      'Harun’un Vekilliği ve Altından Buzağıya Tapma',
      'Hz. Musa’nın Dönüşü ve Tövbe',
      'Filistin’e Gitme Çağrısı',
      'Hz. Musa’nın (a.s.) Kıssasından Çıkarılacak Mesajlar',
    ],
  },
  'ayetel-kursi': {
    title: 'Âyet’el-Kürsî',
    weekStart: '2026-10-12',
    weekEnd: '2026-10-16',
    topics: [
      'Âyet’el-Kürsî Nedir?',
      'Âyet’el-Kürsî Okunuşu',
      'Türkçe Anlamı',
      'Temel Kavramlar (Tevhid, Kürsî, Şefaat)',
      'Geçen Sıfatlar',
      'Ne Zaman Okunur?',
    ],
  },
}

async function main() {
  const [key, ...files] = process.argv.slice(2)
  if (!NOTES[key] || !files.length) throw new Error(`Usage: node seed-lesson-notes-din8.js <${Object.keys(NOTES).join('|')}> <page1.png> [page2.png ...]`)
  const NOTE = { grade: '8', subjectName: 'Din Kültürü ve Ahlak Bilgisi', ...NOTES[key] }
  const images = files.map(f => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`)

  loadLocalSettings()
  const pool = await sql.connect({ ...sql.ConnectionPool.parseConnectionString(process.env.SQL_CONNECTION_STRING), requestTimeout: 120000 })
  try {
    const subject = await pool.request().input('name', sql.NVarChar(200), NOTE.subjectName)
      .query('SELECT id FROM dbo.Subjects WHERE name = @name AND is_active = 1')
    if (subject.recordset.length !== 1) throw new Error(`Subject not found: ${NOTE.subjectName}`)
    const payload = { ...NOTE, subjectId: subject.recordset[0].id, images }
    const error = validateNote(payload)
    if (error) throw new Error(error)

    const existing = await pool.request()
      .input('grade', sql.NVarChar(20), NOTE.grade).input('subjectId', sql.UniqueIdentifier, payload.subjectId)
      .input('title', sql.NVarChar(200), NOTE.title).input('start', sql.Date, NOTE.weekStart)
      .query('SELECT id FROM dbo.LessonNotes WHERE grade = @grade AND subject_id = @subjectId AND title = @title AND week_start = @start')
    if (existing.recordset.length) {
      const id = existing.recordset[0].id
      await pool.request().input('id', sql.UniqueIdentifier, id)
        .input('topics', sql.NVarChar(sql.MAX), JSON.stringify(NOTE.topics)).input('images', sql.NVarChar(sql.MAX), JSON.stringify(images))
        .query('UPDATE dbo.LessonNotes SET topics_json = @topics, images_json = @images WHERE id = @id')
      return console.log('Updated images:', id)
    }

    const inserted = await pool.request()
      .input('grade', sql.NVarChar(20), NOTE.grade).input('subjectId', sql.UniqueIdentifier, payload.subjectId)
      .input('title', sql.NVarChar(200), NOTE.title).input('start', sql.Date, NOTE.weekStart).input('end', sql.Date, NOTE.weekEnd)
      .input('topics', sql.NVarChar(sql.MAX), JSON.stringify(NOTE.topics)).input('images', sql.NVarChar(sql.MAX), JSON.stringify(images))
      .query(`INSERT dbo.LessonNotes (grade, subject_id, title, week_start, week_end, topics_json, images_json)
        OUTPUT inserted.id VALUES (@grade, @subjectId, @title, @start, @end, @topics, @images)`)
    console.log('Inserted:', inserted.recordset[0].id)
  } finally {
    await pool.close()
  }
}

main().catch(error => { console.error(error.message); process.exit(1) })
