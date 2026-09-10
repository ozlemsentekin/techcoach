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

// "Deyimler, Atasözleri ve Özdeyişler" (Fenomen Yayınları) — "1. Bölüm - Deyimler" İçeriği.
// DB'deki cevap anahtarı Test 5-20'de (ve Test 17 soru 3'te) hatalıydı; kitabın "1. BÖLÜM -
// DEYİMLER" cevap anahtarı fotoğrafından (her cevabın yanında soru no yazılı: "1.B 2.A ...")
// doğrulanan diziler aşağıda. Test 1-4 zaten doğruydu (idempotent — dokunulsa da değişmez).
//
// Bu script her testin TestAnswerKeys satırlarını silip yeniden yazar ve question_count'u
// dizinin uzunluğuna eşitler. Ardından bu testleri çözmüş öğrenci kayıtlarını
// (StudentManualTestCompletions + Tasks) yeni anahtara göre yeniden notlar.
const DEYIMLER_TOPIC_ID = 'F1E8100F-53B4-4292-8A26-2ADEC602A07D'

// Test no -> doğru cevap dizisi (fotoğraf). question_count = uzunluk.
const ANSWERS = {
  1: 'BACBADCAAABDC',
  2: 'DCACACADBDCAC',
  3: 'ACDBBCDABDACD',
  4: 'CAAADCACABDCA',
  5: 'BBCDDABDCABD',
  6: 'CDABCADADBADA',
  7: 'ADBBACBADBDC',
  8: 'DDACCCBACCAB',
  9: 'ABABADCCCBBDA',
  10: 'ACBCCDDDBAA',
  11: 'CCBADBAADABD',
  12: 'DBACABDDCDBC',
  13: 'ABACBBCDBABD',
  14: 'BBCDDDBCBCAC',
  15: 'ACDBDABABCDCB',
  16: 'ABDCCBBACCDBA',
  17: 'ACDACDDACCBB',
  18: 'CBDDBBCDBA',
  19: 'AACACDBCBBCBD',
  20: 'BAACCBBCBBCD',
}

const BLANK = '-'

function grade(answersObj, keySeq) {
  let correct = 0
  let wrong = 0
  for (let i = 1; i <= keySeq.length; i += 1) {
    const s = answersObj[String(i)]
    if (!s || s === BLANK) continue
    if (s === keySeq[i - 1]) correct += 1
    else wrong += 1
  }
  const blank = keySeq.length - correct - wrong
  const correctLabels = {}
  keySeq.split('').forEach((l, i) => { correctLabels[String(i + 1)] = l })
  return { correct, wrong, blank, gradedAt: new Date().toISOString(), correctLabels }
}

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  const total = Object.values(ANSWERS).reduce((a, s) => a + s.length, 0)
  for (const [no, a] of Object.entries(ANSWERS)) {
    if (!/^[A-D]+$/.test(a)) throw new Error(`Geçersiz dizi: Test ${no} — ${a}`)
  }
  console.log(`Toplam soru (fotoğraf): ${total}\n`)

  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const testsRes = await pool.request().input('tid', sql.UniqueIdentifier, DEYIMLER_TOPIC_ID).query(`
      SELECT tt.id, tt.name, tt.question_count,
        (SELECT STRING_AGG(CAST(correct_label AS NVARCHAR(2)), '') WITHIN GROUP (ORDER BY order_no)
         FROM dbo.TestAnswerKeys k WHERE k.test_id = tt.id) AS seq
      FROM dbo.ResourceBookTopicTests tt WHERE tt.topic_id = @tid ORDER BY tt.page_start;`)
    if (testsRes.recordset.length !== 20) throw new Error(`Beklenen 20 test, bulunan ${testsRes.recordset.length}`)

    const idByNo = new Map()
    const changedTestIds = new Set()
    let changed = 0

    for (const row of testsRes.recordset) {
      const no = parseInt((row.name.match(/\d+/) || [])[0], 10)
      const want = ANSWERS[no]
      if (!want) throw new Error(`Beklenmeyen test adı: ${row.name}`)
      idByNo.set(no, row.id)

      if (row.seq === want && row.question_count === want.length) {
        console.log(`Test ${no}: değişiklik yok (${want})`)
        continue
      }
      changed += 1
      changedTestIds.add(String(row.id).toLowerCase())
      console.log(`Test ${no}: ${row.seq || 'boş'} (qc=${row.question_count})  ->  ${want} (qc=${want.length})`)

      const tx = new sql.Transaction(pool)
      await tx.begin()
      try {
        await new sql.Request(tx).input('id', sql.UniqueIdentifier, row.id)
          .query('DELETE FROM dbo.TestAnswerKeys WHERE test_id = @id;')
        const ins = new sql.Request(tx).input('id', sql.UniqueIdentifier, row.id)
        const vals = []
        want.split('').forEach((l, i) => {
          ins.input(`o${i}`, sql.Int, i + 1)
          ins.input(`l${i}`, sql.NChar(1), l)
          vals.push(`(@id, @o${i}, @l${i})`)
        })
        await ins.query(`INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label) VALUES ${vals.join(', ')};`)
        await new sql.Request(tx).input('id', sql.UniqueIdentifier, row.id).input('qc', sql.Int, want.length)
          .query('UPDATE dbo.ResourceBookTopicTests SET question_count = @qc WHERE id = @id;')
        await tx.commit()
      } catch (e) {
        await tx.rollback()
        throw e
      }
    }
    console.log(`\nCevap anahtarı: ${changed} test güncellendi, ${20 - changed} test zaten doğruydu.`)

    // ---- Öğrenci kayıtlarını yeniden notla ----
    const testIds = [...idByNo.values()]
    const idList = testIds.map((x) => `'${x}'`).join(',')
    const keyByTestId = new Map()
    for (const [no, id] of idByNo) keyByTestId.set(String(id).toLowerCase(), ANSWERS[no])

    // 1) StudentManualTestCompletions
    const smtc = await pool.request().query(`
      SELECT c.id, c.student_id, c.test_id, c.correct_count, c.wrong_count, c.blank_count, c.answers_json, u.full_name
      FROM dbo.StudentManualTestCompletions c LEFT JOIN dbo.Users u ON u.id = c.student_id
      WHERE c.test_id IN (${idList});`)
    console.log(`\nManuel test tamamlama (StudentManualTestCompletions): ${smtc.recordset.length} kayıt`)
    let smtcFixed = 0
    for (const r of smtc.recordset) {
      if (!changedTestIds.has(String(r.test_id).toLowerCase())) {
        console.log(`  ${r.full_name}: bu testin anahtarı değişmedi, atlandı`)
        continue
      }
      const key = keyByTestId.get(String(r.test_id).toLowerCase())
      const ans = r.answers_json ? JSON.parse(r.answers_json) : {}
      const g = grade(ans, key)
      if (g.correct === r.correct_count && g.wrong === r.wrong_count && g.blank === r.blank_count) {
        console.log(`  ${r.full_name}: değişiklik yok (D${g.correct}/Y${g.wrong}/B${g.blank})`)
        continue
      }
      await pool.request()
        .input('id', sql.UniqueIdentifier, r.id)
        .input('c', sql.Int, g.correct).input('w', sql.Int, g.wrong).input('b', sql.Int, g.blank)
        .query('UPDATE dbo.StudentManualTestCompletions SET correct_count=@c, wrong_count=@w, blank_count=@b WHERE id=@id;')
      smtcFixed += 1
      console.log(`  ${r.full_name}: D${r.correct_count}/Y${r.wrong_count}/B${r.blank_count} -> D${g.correct}/Y${g.wrong}/B${g.blank}`)
    }

    // 2) Tasks (SB ödevi)
    const req2 = pool.request()
    testIds.forEach((id, i) => req2.input(`p${i}`, sql.NVarChar(sql.MAX), `%${id}%`))
    const tasks = await req2.query(`
      SELECT t.id, t.student_id, t.status, t.correct_count, t.wrong_count, t.blank_count, t.completed_at,
             t.selected_test_ids_json, t.answers_json, t.test_results_json, u.full_name
      FROM dbo.Tasks t LEFT JOIN dbo.Users u ON u.id = t.student_id
      WHERE ${testIds.map((_, i) => `t.selected_test_ids_json LIKE @p${i}`).join(' OR ')};`)
    console.log(`\nSoru bankası ödevi (Tasks): ${tasks.recordset.length} kayıt`)

    // Görevdeki her testin question_count'u (güncel)
    let tasksFixed = 0
    for (const t of tasks.recordset) {
      const sel = t.selected_test_ids_json ? JSON.parse(t.selected_test_ids_json) : []
      const answers = t.answers_json ? JSON.parse(t.answers_json) : {}
      const results = t.test_results_json ? JSON.parse(t.test_results_json) : {}

      // Görevin anahtarı değişen bir teste dokunması gerekiyor; yoksa (ör. Test 1-4) atla.
      const touchesChanged = sel.some((id) => changedTestIds.has(String(id).toLowerCase()))
      if (!touchesChanged) {
        console.log(`  ${t.full_name} · task ${t.id}: anahtarı değişen test içermiyor (${t.status}), atlandı`)
        continue
      }

      // güncel question_count + cevap anahtarı (Deyimler dışı testler DB'den)
      const qcById = new Map()
      const keyById = new Map()
      for (const id of sel) {
        const lc = String(id).toLowerCase()
        if (keyByTestId.has(lc)) {
          keyById.set(id, keyByTestId.get(lc))
          qcById.set(id, keyByTestId.get(lc).length)
        } else {
          const m = await pool.request().input('id', sql.UniqueIdentifier, id).query(`
            SELECT tt.question_count,
              (SELECT STRING_AGG(CAST(correct_label AS NVARCHAR(2)), '') WITHIN GROUP (ORDER BY order_no)
               FROM dbo.TestAnswerKeys k WHERE k.test_id = tt.id) AS seq
            FROM dbo.ResourceBookTopicTests tt WHERE tt.id = @id;`)
          qcById.set(id, m.recordset[0]?.question_count || 0)
          keyById.set(id, m.recordset[0]?.seq || null)
        }
      }

      let totalCompleted = 0
      let totalCorrect = 0
      let totalWrong = 0
      let totalBlank = 0
      let allGraded = true
      for (const id of sel) {
        const qc = qcById.get(id) || 0
        const testAnswers = answers[id] || {}
        const answeredCount = Object.keys(testAnswers).length
        totalCompleted += Math.min(answeredCount, qc)
        const key = keyById.get(id)
        if (qc && answeredCount >= qc && key && key.length === qc) {
          const g = grade(testAnswers, key)
          const prev = results[id]
          // Sonuç birebir aynıysa eski kaydı (gradedAt dahil) koru — gereksiz yazma olmasın.
          const unchanged =
            prev && prev.correct === g.correct && prev.wrong === g.wrong && prev.blank === g.blank &&
            JSON.stringify(prev.correctLabels || {}) === JSON.stringify(g.correctLabels)
          results[id] = unchanged ? prev : g
          totalCorrect += g.correct
          totalWrong += g.wrong
          totalBlank += g.blank
        } else {
          delete results[id]
          allGraded = false
        }
      }
      const nextStatus = allGraded ? 'tamamlandi' : totalCompleted > 0 ? 'devam-ediyor' : 'bekliyor'
      const nextCompletedAt = allGraded ? (t.completed_at || new Date()) : null

      // Basit karşılaştırma: sadece grade edilebilen testler varsa güncelle
      const anyGradable = sel.some((id) => {
        const qc = qcById.get(id) || 0
        const key = keyById.get(id)
        return qc && Object.keys(answers[id] || {}).length >= qc && key && key.length === qc
      })
      if (!anyGradable) {
        console.log(`  ${t.full_name} · task ${t.id}: çözülmüş test yok (${t.status}), atlandı`)
        continue
      }

      const before = `D${t.correct_count}/Y${t.wrong_count}/B${t.blank_count} (${t.status})`
      const after = `D${totalCorrect}/Y${totalWrong}/B${totalBlank} (${nextStatus})`
      if (before === after && JSON.stringify(results) === (t.test_results_json || '{}')) {
        console.log(`  ${t.full_name} · task ${t.id}: değişiklik yok — ${after}`)
        continue
      }
      await pool.request()
        .input('id', sql.UniqueIdentifier, t.id)
        .input('rj', sql.NVarChar(sql.MAX), JSON.stringify(results))
        .input('cq', sql.Int, totalCompleted)
        .input('c', sql.Int, totalCorrect).input('w', sql.Int, totalWrong).input('b', sql.Int, totalBlank)
        .input('s', sql.NVarChar(30), nextStatus)
        .input('ca', sql.DateTime2, nextCompletedAt)
        .query(`UPDATE dbo.Tasks SET test_results_json=@rj, completed_question_count=@cq,
                correct_count=@c, wrong_count=@w, blank_count=@b, status=@s, completed_at=@ca WHERE id=@id;`)
      tasksFixed += 1
      console.log(`  ${t.full_name} · task ${t.id}: ${before} -> ${after}`)
    }

    // 3) Artık doğru cevaplanan sorular için 'cevap-kagidi' Hata Defteri kayıtlarını temizle
    const wq = await pool.request().query(`
      SELECT w.id, w.student_id, w.test_id, w.task_id, w.question_number, w.error_type
      FROM dbo.WrongQuestions w WHERE w.test_id IN (${idList}) AND w.error_type = 'cevap-kagidi';`)
    let wqPruned = 0
    for (const r of wq.recordset) {
      const key = keyByTestId.get(String(r.test_id).toLowerCase())
      const qn = Number(r.question_number)
      const correctLabel = key && qn >= 1 && qn <= key.length ? key[qn - 1] : null
      // öğrencinin cevabını bul
      let studentAnswer = null
      if (r.task_id) {
        const tr = await pool.request().input('id', sql.UniqueIdentifier, r.task_id).query('SELECT answers_json FROM dbo.Tasks WHERE id=@id;')
        const aj = tr.recordset[0]?.answers_json ? JSON.parse(tr.recordset[0].answers_json) : {}
        studentAnswer = aj[r.test_id]?.[String(qn)] ?? aj[String(r.test_id).toLowerCase()]?.[String(qn)] ?? null
      } else {
        const cr = await pool.request().input('sid', sql.UniqueIdentifier, r.student_id).input('tid', sql.UniqueIdentifier, r.test_id)
          .query('SELECT answers_json FROM dbo.StudentManualTestCompletions WHERE student_id=@sid AND test_id=@tid;')
        const aj = cr.recordset[0]?.answers_json ? JSON.parse(cr.recordset[0].answers_json) : {}
        studentAnswer = aj[String(qn)] ?? null
      }
      const nowCorrect = correctLabel && studentAnswer && studentAnswer !== BLANK && studentAnswer === correctLabel
      if (nowCorrect) {
        await pool.request().input('id', sql.UniqueIdentifier, r.id).query('DELETE FROM dbo.WrongQuestions WHERE id=@id;')
        wqPruned += 1
        console.log(`  Hata Defteri temizlendi: test ${r.test_id} soru ${qn} (artık doğru: ${studentAnswer})`)
      }
    }

    console.log(
      `\nBitti. Anahtar güncellenen test: ${changed}, ` +
        `yeniden notlanan manuel tamamlama: ${smtcFixed}, yeniden notlanan görev: ${tasksFixed}, ` +
        `temizlenen Hata Defteri kaydı: ${wqPruned}.`,
    )
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Fix failed')
  console.error(error)
  process.exit(1)
})
