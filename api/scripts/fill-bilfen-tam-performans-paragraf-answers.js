const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const localSettingsPath = path.join(__dirname, '..', 'local.settings.json')

function loadLocalSettings() {
  if (!fs.existsSync(localSettingsPath)) return
  const parsed = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([key, value]) => {
    if (!process.env[key] && typeof value === 'string') {
      process.env[key] = value
    }
  })
}

const RESOURCE_BOOK_ID = '67287FF3-FFE2-47AE-A127-69A9A7104B5A' // Bilfen Yayınları / Tam Performans Paragraf Soru Bankası

// Transcribed from the book's own answer-key summary pages, matched by test_id.
// "Test 16" has a duplicate row in the DB (two identical test rows, same page range) —
// both get the same answer key since they represent the same physical test.
const ENTRIES = [
  ['64D62874-FC0D-4A37-90A8-AF70987373DD', 'Test 13', 12, 'CACABBCBCBDC'],
  ['6BE977C5-1BD5-4B1F-873A-047F59B271F2', 'Test 14', 11, 'CDBCCCDCBAA'],
  ['EE7F642B-20C3-4661-A11C-4975A510529B', 'Test 15', 13, 'BBCDABCBBDCBB'],
  ['ACF07116-275B-4A72-8580-506A9A8EECE7', 'Test 16', 13, 'CADDCBCBCABCD'],
  ['A60F648C-67B1-431B-AF50-38EDB6484DAC', 'Test 16', 13, 'CADDCBCBCABCD'],
  ['CE0ACA31-E7B0-4FF2-9C83-E94E216BC294', 'Test 17', 13, 'CDBDACBABBCDC'],
  ['0707A31D-70F4-4C9E-8A14-AE628D3EE112', 'Test 18', 11, 'DABBAADACBA'],
  ['C70CF99D-0ADF-49BC-ABEB-4E21BAE1B337', 'Test 19', 12, 'BADBDCDCCABD'],
  ['238C2B1E-8277-413C-BE02-B815D881A25F', 'Test 20', 9, 'BBCBBDABD'],
  ['2AD7AE1A-FAD6-4EC2-913D-197621CB0D3A', 'Test 24', 9, 'DADCCDBAD'],
  ['58057A37-7695-4B8F-B0C5-E6105670214D', 'Test 25', 7, 'ACDBDCA'],
  ['FF5F1DD2-EE52-4184-9343-90C6BEE640F3', 'Test 26', 8, 'BCBDACCA'],
  ['C1E0FA78-1B79-4DF2-9019-F497ACD2DF4D', 'Test 27', 4, 'CBAD'],
  ['3186DE81-EFA2-410C-A384-7C28602EFAFF', 'Test 28', 4, 'BCBC'],
  ['63606389-A608-413C-BDE1-BACF35253176', 'Test 29', 5, 'DBACB'],
  ['D0A48318-B34E-4491-8AF7-190B7BBF65B3', 'Test 30', 6, 'DACCDA'],
  ['C6572F29-DA36-4827-BF7D-CACF3C9C01D2', 'Test 31', 5, 'BADCC'],
  ['EA00C172-2B64-48A0-AC50-29A4DDE13551', 'Test 32', 7, 'BDADCAC'],
  ['E43329D3-DA41-478F-980E-271E63A77267', 'Test 33', 11, 'CBCABABDCCB'],
  ['1609C25D-75C1-46DB-BD9D-B2933D7821B4', 'Test 34', 10, 'CBADADBCAB'],
  ['AC370E1E-A3C2-4F20-BB13-355572CD6DED', 'Test 35', 9, 'ABCBACDBD'],
  ['DB6FD54C-BBB0-438C-9793-6D84D67076CD', 'Test 36', 13, 'BAACDABBCCABC'],
  ['DD970C22-0EF1-4D83-B909-B8486006954D', 'Test 37', 10, 'ACDCBCACBB'],
  ['76EBAE71-0C75-42E9-A067-F744113F9C98', 'Test 38', 10, 'BDBACBADCD'],
  ['9EA14515-F278-4656-BADB-1939879910A6', 'Test 39', 10, 'BCDBDCABAC'],
  ['7DD6D57C-F0ED-438F-B10A-6A6345130D7F', 'Test 40', 10, 'DABCDCBDAD'],
  ['66D74893-E9E4-4B0E-942D-6138F2F57462', 'Test 41', 10, 'DCDBAADDBC'],
]

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  for (const [testId, testName, count, answers] of ENTRIES) {
    if (answers.length !== count) {
      throw new Error(`Length mismatch: ${testName} (${testId}) — expected ${count}, got ${answers.length}`)
    }
  }

  const pool = await sql.connect(connectionString)

  try {
    const rowsResult = await pool
      .request()
      .input('resourceBookId', sql.UniqueIdentifier, RESOURCE_BOOK_ID).query(`
        SELECT tt.id AS test_id, tt.name AS test_name, tt.question_count,
          (SELECT COUNT(*) FROM dbo.TestAnswerKeys ak WHERE ak.test_id = tt.id) AS answer_count
        FROM dbo.ResourceBookTopics t
        INNER JOIN dbo.ResourceBookTopicTests tt ON tt.topic_id = t.id
        WHERE t.resource_book_id = @resourceBookId;
      `)

    const byId = new Map()
    for (const row of rowsResult.recordset) {
      byId.set(row.test_id.toUpperCase(), row)
    }

    let inserted = 0
    let skippedAlready = 0
    const notFound = []

    for (const [testId, testName, count, answers] of ENTRIES) {
      const row = byId.get(testId.toUpperCase())

      if (!row) {
        notFound.push(`${testName} (${testId})`)
        continue
      }
      if (row.question_count !== count) {
        throw new Error(`Question count mismatch for ${testName} (${testId}): DB has ${row.question_count}, expected ${count}`)
      }
      if (row.answer_count > 0) {
        console.log(`Skip (already has answer key): ${testName} (${testId})`)
        skippedAlready += 1
        continue
      }

      const letters = answers.split('')
      const request = pool.request().input('testId', sql.UniqueIdentifier, row.test_id)
      const values = []
      letters.forEach((label, idx) => {
        const orderParam = `order${idx}`
        const labelParam = `label${idx}`
        request.input(orderParam, sql.Int, idx + 1)
        request.input(labelParam, sql.NChar(1), label)
        values.push(`(@testId, @${orderParam}, @${labelParam})`)
      })
      await request.query(`
        INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label)
        VALUES ${values.join(', ')};
      `)
      inserted += 1
      console.log(`Inserted: ${testName} (${testId}) (${letters.length} answers)`)
    }

    console.log(`\nDone. Inserted: ${inserted}, already had answers: ${skippedAlready}`)
    if (notFound.length) {
      console.log(`Not found in DB (skipped): ${notFound.length}`)
      notFound.forEach((k) => console.log(`  - ${k}`))
    }
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Fill failed')
  console.error(error)
  process.exit(1)
})
