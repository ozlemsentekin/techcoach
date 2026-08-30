const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const localSettingsPath = path.join(__dirname, '..', 'local.settings.json')
function loadLocalSettings() {
  if (!fs.existsSync(localSettingsPath)) return
  const parsed = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([key, value]) => {
    if (!process.env[key] && typeof value === 'string') process.env[key] = value
  })
}

// Fenomen "1. Fasikül - Çarpanlar ve Katlar" (8. Sınıf Matematik).
// Zaten bölüm başına bir ResourceBookTopic var ama hepsi "1. Ünite - ..." diye adlandırılmış.
// Bunları kaynağın "İçindekiler" bölüm adlarına çevirir (2. ve 3. Fasikül'le aynı yapı).
// Testler taşınmıyor, cevap anahtarlarına dokunulmuyor — yalnızca içerik adı + topic_name.
const RESOURCE_BOOK_ID = '544A4148-9FB2-4AB7-B97A-34F1F3B2E0E2'

// Her bölüm, testlerinden birinin mevcut topic_name'iyle tanınır (probeKonu).
// newName: yeni İçerik adı. unifyTopicName: true ise bölümdeki tüm testlerin
// topic_name'i newName ile eşitlenir; false ise mevcut topic_name korunur
// (EKOK bölümünde "Test 1/2" çakışmasını önlemek için).
const SECTIONS = [
  { probeKonu: 'Pozitif Tam Sayının Çarpanları', newName: 'Pozitif Tam Sayının Çarpanları', unifyTopicName: true },
  { probeKonu: 'Asal Sayılar', newName: 'Asal Sayılar', unifyTopicName: true },
  { probeKonu: 'Bir Tam Sayıyı Asal Çarpanlara Ayırma', newName: 'Bir Tam Sayıyı Asal Çarpanlara Ayırma', unifyTopicName: true },
  { probeKonu: 'En Büyük Ortak Bölen (EBOB)', newName: 'En Büyük Ortak Bölen (EBOB)', unifyTopicName: true },
  { probeKonu: 'En Küçük Ortak Kat (EKOK)', newName: 'En Küçük Ortak Kat (EKOK)', unifyTopicName: false },
  { probeKonu: 'Aralarında Asal Sayılar', newName: 'Aralarında Asal Sayılar', unifyTopicName: true },
]

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const topics = await pool
      .request()
      .input('rb', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT id, name FROM dbo.ResourceBookTopics WHERE resource_book_id = @rb ORDER BY created_at;')

    // probeKonu -> topicId eşlemesi
    const topicIdByProbe = {}
    for (const t of topics.recordset) {
      const konu = await pool
        .request()
        .input('tid', sql.UniqueIdentifier, t.id)
        .query('SELECT DISTINCT topic_name FROM dbo.ResourceBookTopicTests WHERE topic_id = @tid;')
      const konular = konu.recordset.map((r) => r.topic_name)
      for (const s of SECTIONS) {
        if (konular.includes(s.probeKonu)) topicIdByProbe[s.probeKonu] = t.id
      }
    }

    // Tüm bölümler bulunmalı ve her biri farklı topic'e denk gelmeli.
    const ids = SECTIONS.map((s) => topicIdByProbe[s.probeKonu])
    if (ids.some((x) => !x)) {
      throw new Error('Bazı bölümler eşleşmedi: ' + JSON.stringify(topicIdByProbe))
    }
    if (new Set(ids).size !== SECTIONS.length) {
      throw new Error('Bölümler aynı topic\'e denk geldi: ' + JSON.stringify(ids))
    }

    for (const s of SECTIONS) {
      const topicId = topicIdByProbe[s.probeKonu]
      await pool
        .request()
        .input('id', sql.UniqueIdentifier, topicId)
        .input('name', sql.NVarChar(200), s.newName)
        .query('UPDATE dbo.ResourceBookTopics SET name = @name WHERE id = @id;')

      let tnUpdated = 0
      if (s.unifyTopicName) {
        const r = await pool
          .request()
          .input('tid', sql.UniqueIdentifier, topicId)
          .input('name', sql.NVarChar(200), s.newName)
          .query('UPDATE dbo.ResourceBookTopicTests SET topic_name = @name WHERE topic_id = @tid;')
        tnUpdated = r.rowsAffected[0]
      }
      console.log(`İçerik: "${s.probeKonu}" grubu -> "${s.newName}"${s.unifyTopicName ? ` (${tnUpdated} testin topic_name'i eşitlendi)` : ' (topic_name korundu)'}`)
    }

    console.log('\nTamamlandı.')
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Restructure failed')
  console.error(error)
  process.exit(1)
})
