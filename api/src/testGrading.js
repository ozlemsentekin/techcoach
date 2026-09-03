const { sql, withRequest } = require('./db')

// Öğrencinin cevabını bilmediği bir soruyu bilinçli olarak "boş" işaretlemesini temsil eder.
// Cevaplanmamış (key hiç yok) durumdan farklıdır: bu işaret "cevaplandı" sayılır ama notlama
// sırasında hep boş sayılır.
const BLANK_ANSWER_LABEL = '-'
const VALID_ANSWER_LABELS = ['A', 'B', 'C', 'D', BLANK_ANSWER_LABEL]

function sanitizeAnswers(rawAnswers) {
  const sanitized = {}
  Object.entries(rawAnswers || {}).forEach(([orderNo, label]) => {
    const normalizedLabel = typeof label === 'string' ? label.trim().toUpperCase() : ''
    if (VALID_ANSWER_LABELS.includes(normalizedLabel)) {
      sanitized[orderNo] = normalizedLabel
    }
  })
  return sanitized
}

// Cevap anahtarı testin tüm sorularını kapsamıyorsa veya öğrenci henüz tüm soruları
// işaretlememişse notlama yapılmaz (result: null).
async function gradeTestAnswers(testId, questionCount, rawAnswers) {
  const sanitizedAnswers = sanitizeAnswers(rawAnswers)
  const answeredCount = Object.keys(sanitizedAnswers).length

  if (!questionCount || answeredCount < questionCount) {
    return { answers: sanitizedAnswers, result: null }
  }

  const keyDb = await withRequest({ testId: { type: sql.UniqueIdentifier, value: testId } })
  const keyResult = await keyDb.query(`
    SELECT order_no, correct_label FROM dbo.TestAnswerKeys WHERE test_id = @testId ORDER BY order_no ASC;
  `)

  if (keyResult.recordset.length !== questionCount) {
    return { answers: sanitizedAnswers, result: null }
  }

  let correct = 0
  let wrong = 0
  const correctLabels = {}
  keyResult.recordset.forEach((row) => {
    const correctLabel = row.correct_label.trim()
    correctLabels[String(row.order_no)] = correctLabel
    const studentLabel = sanitizedAnswers[String(row.order_no)]
    if (!studentLabel || studentLabel === BLANK_ANSWER_LABEL) return
    if (studentLabel === correctLabel) correct += 1
    else wrong += 1
  })
  const blank = questionCount - correct - wrong

  return {
    answers: sanitizedAnswers,
    result: { correct, wrong, blank, gradedAt: new Date().toISOString(), correctLabels },
  }
}

// Optik form yeniden notlandığında: daha önce yanlış işaretlenip Hata Defteri'ne (fotoğrafıyla)
// düşmüş bir soru artık doğru cevaplanmışsa, ilgili WrongQuestions satırını siler. Bu satırlar
// yalnızca fotoğraf eklendiğinde oluşturulduğundan (saveWrongQuestionPhotoHandler ve manuel optik
// muadilleri), satırı silmek fotoğrafı da hata defterinden kaldırır. Sadece optik kaynaklı
// (error_type = 'cevap-kagidi') kayıtlara dokunur; taskId verilirse o göreve, verilmezse task'a
// bağlı olmayan (bookshelf / manuel optik) kayda uygulanır.
async function pruneCorrectedWrongQuestions(studentId, testId, answers, correctLabels, { taskId = null } = {}) {
  const correctedQuestionNumbers = Object.keys(correctLabels || {}).filter((orderNo) => {
    const studentLabel = answers?.[orderNo]
    return Boolean(studentLabel) && studentLabel !== BLANK_ANSWER_LABEL && studentLabel === correctLabels[orderNo]
  })
  if (!correctedQuestionNumbers.length) return

  const bindings = {
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    testId: { type: sql.UniqueIdentifier, value: testId },
  }
  if (taskId) bindings.taskId = { type: sql.UniqueIdentifier, value: taskId }
  const placeholders = correctedQuestionNumbers.map((orderNo, index) => {
    bindings[`q${index}`] = { type: sql.NVarChar(20), value: String(orderNo) }
    return `@q${index}`
  })

  const db = await withRequest(bindings)
  await db.query(`
    DELETE FROM dbo.WrongQuestions
    WHERE student_id = @studentId
      AND test_id = @testId
      AND ${taskId ? 'task_id = @taskId' : 'task_id IS NULL'}
      AND error_type = 'cevap-kagidi'
      AND question_number IN (${placeholders.join(', ')});
  `)
}

module.exports = { BLANK_ANSWER_LABEL, sanitizeAnswers, gradeTestAnswers, pruneCorrectedWrongQuestions }
