const { withRequest, withTransaction } = require('../src/db')
const { normalizePhone } = require('../src/security')
const {
  ensureTeacherPanelUser,
  linkMatchingTeacherRowsToPanelUser,
} = require('../src/students')

function normalizeName(value) {
  return String(value || '').trim().toLocaleLowerCase('tr-TR')
}

function parseArgs(argv) {
  const options = {
    all: false,
    dryRun: false,
    names: new Set(),
    phones: new Set(),
  }

  argv.forEach((arg) => {
    if (arg === '--all') {
      options.all = true
      return
    }
    if (arg === '--dry-run') {
      options.dryRun = true
      return
    }
    if (arg.startsWith('--name=')) {
      const name = normalizeName(arg.slice('--name='.length))
      if (name) options.names.add(name)
      return
    }
    if (arg.startsWith('--phone=')) {
      const phone = normalizePhone(arg.slice('--phone='.length))
      if (phone) options.phones.add(phone)
      return
    }

    throw new Error(`Bilinmeyen argüman: ${arg}`)
  })

  return options
}

function matchesTarget(row, options) {
  if (options.all) return true
  return options.names.has(normalizeName(row.teacher_full_name)) || options.phones.has(row.normalizedPhone)
}

async function fetchCandidateTeacherRows() {
  const requestDb = await withRequest({})
  const result = await requestDb.query(`
    SELECT st.id, st.teacher_full_name, st.phone, st.teacher_user_id,
           st.student_id, u.parent_id, u.full_name AS student_full_name
    FROM dbo.StudentTeachers st
    INNER JOIN dbo.Users u ON u.id = st.student_id
    WHERE st.is_active = 1
    ORDER BY st.created_at ASC;
  `)

  return result.recordset.map((row) => ({
    ...row,
    normalizedPhone: normalizePhone(row.phone),
  }))
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (!options.all && options.names.size === 0 && options.phones.size === 0) {
    throw new Error(
      'Kullanım: node api/scripts/backfill-teacher-panel-accounts.js --phone=05XXXXXXXXX [--phone=...] veya --all',
    )
  }

  const rows = (await fetchCandidateTeacherRows()).filter((row) => matchesTarget(row, options))
  const processedKeys = new Set()
  const summary = { linkedGroups: 0, createdAccounts: 0, reusedAccounts: 0, skipped: 0, failed: 0 }

  for (const row of rows) {
    if (row.teacher_user_id) {
      summary.skipped += 1
      console.log(`Atlandı (zaten bağlı): ${row.teacher_full_name} / ${row.phone}`)
      continue
    }

    const key = `${row.parent_id}:${normalizeName(row.teacher_full_name)}:${row.normalizedPhone || row.phone}`
    if (processedKeys.has(key)) {
      continue
    }
    processedKeys.add(key)

    if (!row.normalizedPhone) {
      summary.skipped += 1
      console.warn(`Atlandı (telefon geçersiz): ${row.teacher_full_name} / ${row.phone}`)
      continue
    }

    if (options.dryRun) {
      console.log(`DRY RUN: ${row.teacher_full_name} için öğretmen hesabı hazırlanıp öğrenci bağlantıları eşitlenecek.`)
      continue
    }

    try {
      const result = await withTransaction(async (requestInTransaction) => {
        const panelUser = await ensureTeacherPanelUser({
          requestFactory: requestInTransaction,
          fullName: row.teacher_full_name,
          normalizedPhone: row.normalizedPhone,
        })
        const linkedIds = await linkMatchingTeacherRowsToPanelUser({
          requestFactory: requestInTransaction,
          parentId: row.parent_id,
          teacherId: row.id,
          fullName: row.teacher_full_name,
          normalizedPhone: row.normalizedPhone,
          teacherUserId: panelUser.teacherUserId,
        })

        return { ...panelUser, linkedCount: linkedIds.length }
      })

      summary.linkedGroups += 1
      if (result.isNewAccount) {
        summary.createdAccounts += 1
        console.log(`Oluşturuldu ve bağlandı: ${row.teacher_full_name} (${result.linkedCount} ilişki)`)
      } else {
        summary.reusedAccounts += 1
        console.log(`Mevcut hesap bağlandı: ${row.teacher_full_name} (${result.linkedCount} ilişki)`)
      }
    } catch (error) {
      summary.failed += 1
      console.error(`Başarısız: ${row.teacher_full_name} / ${row.phone} - ${error.publicMessage || error.message}`)
    }
  }

  console.log(
    `Tamamlandı. Grup: ${summary.linkedGroups}, yeni hesap: ${summary.createdAccounts}, mevcut hesap: ${summary.reusedAccounts}, atlanan: ${summary.skipped}, hata: ${summary.failed}`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('backfill-teacher-panel-accounts failed')
    console.error(error.message)
    process.exit(1)
  })
