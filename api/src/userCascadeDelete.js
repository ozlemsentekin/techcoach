const { sql } = require('./db')

const GUID_RE = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/

// deleteUserHandler'ın basit silmesi (Entitlements/TeacherEntitlements/Users tek satır) FK
// constraint'e (547) takıldığında çağrılır — admin "Sil"e basarak bu bağımlı kayıtların da
// silinmesini zaten onaylamış sayılır. api/scripts/hard-delete-users-cascade.js ile aynı
// algoritma: dbo.Users(id)'e referans veren TÜM FK kolonları sys katalogundan dinamik
// bulunur (NOT NULL → satır silinir, NULL kabul eden → NULL'a çekilir), FK zinciri sırası
// için sweep birden çok pass tekrarlanır. rootUserId'nin çocukları (Users.parent_id = rootUserId,
// yani öğrenci hesapları) hedef kümeye eklenir ki self-reference sweep'i onları NULL'lamak
// yerine tamamen silsin (CK_Users_StudentRequiresParent, öğrencinin parent_id'siz kalmasına
// izin vermiyor).
async function cascadeDeleteUserAndDependents(requestInTransaction, rootUserId) {
  if (!GUID_RE.test(rootUserId)) {
    throw new Error(`Geçersiz kullanıcı id: ${rootUserId}`)
  }

  const targetSet = new Set([rootUserId])
  const kids = await requestInTransaction({ pid: { type: sql.UniqueIdentifier, value: rootUserId } }).query(`
    SELECT id FROM dbo.Users WHERE parent_id = @pid;
  `)
  kids.recordset.forEach((row) => targetSet.add(row.id))

  const targetIds = [...targetSet]
  const targetsIn = targetIds.map((id) => `'${id}'`).join(', ')

  const fkResult = await requestInTransaction().query(`
    SELECT OBJECT_SCHEMA_NAME(fk.parent_object_id) AS schema_name,
           OBJECT_NAME(fk.parent_object_id)        AS table_name,
           c.name                                  AS column_name,
           c.is_nullable                           AS is_nullable
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    JOIN sys.columns c  ON c.object_id  = fkc.parent_object_id     AND c.column_id  = fkc.parent_column_id
    JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
    WHERE fk.referenced_object_id = OBJECT_ID('dbo.Users') AND rc.name = 'id';
  `)

  const totals = {}
  const MAX_PASSES = 10
  let pass = 0
  let pending = fkResult.recordset.slice()

  while (pending.length && pass < MAX_PASSES) {
    pass += 1
    const stillPending = []
    let progressed = false

    for (const fk of pending) {
      const table = `[${fk.schema_name}].[${fk.table_name}]`
      const col = `[${fk.column_name}]`
      const key = `${fk.table_name}.${fk.column_name}`
      const selfRef = fk.table_name === 'Users'
      const query = fk.is_nullable
        ? `UPDATE t SET t.${col} = NULL FROM ${table} t
           WHERE t.${col} IN (${targetsIn})
           ${selfRef ? `AND t.id NOT IN (${targetsIn})` : ''};`
        : selfRef
          ? `DELETE t FROM ${table} t WHERE t.${col} IN (${targetsIn}) AND t.id NOT IN (${targetsIn});`
          : `DELETE t FROM ${table} t WHERE t.${col} IN (${targetsIn});`

      try {
        const r = await requestInTransaction().query(query)
        const n = r.rowsAffected[0] || 0
        totals[key] = (totals[key] || 0) + n
        if (n > 0) progressed = true
      } catch (err) {
        if (err.number === 547) {
          stillPending.push(fk)
        } else {
          throw err
        }
      }
    }

    pending = stillPending
    if (pending.length && !progressed) {
      throw new Error(
        `FK zinciri çözülemedi (pass ${pass}). Kalan: ${pending.map((f) => `${f.table_name}.${f.column_name}`).join(', ')}`,
      )
    }
  }

  await requestInTransaction().query(`DELETE FROM dbo.Entitlements WHERE parent_id IN (${targetsIn});`)
  await requestInTransaction().query(`DELETE FROM dbo.TeacherEntitlements WHERE teacher_id IN (${targetsIn});`)
  const usersDeleted = await requestInTransaction().query(`DELETE FROM dbo.Users WHERE id IN (${targetsIn});`)

  return {
    targetIds,
    totals,
    usersDeleted: usersDeleted.rowsAffected[0] || 0,
  }
}

module.exports = { cascadeDeleteUserAndDependents }
