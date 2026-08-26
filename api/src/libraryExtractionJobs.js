const { sql, withRequest } = require('./db')

async function createExtractionJob({ jobType, actorUserId }) {
  const request = await withRequest({
    jobType: { type: sql.NVarChar(20), value: jobType },
    actorUserId: { type: sql.UniqueIdentifier, value: actorUserId },
  })
  const result = await request.query(`
    INSERT INTO dbo.LibraryExtractionJobs (job_type, created_by_user_id)
    OUTPUT inserted.id
    VALUES (@jobType, @actorUserId);
  `)
  return result.recordset[0].id
}

async function completeExtractionJob(jobId, resultData) {
  const request = await withRequest({
    id: { type: sql.UniqueIdentifier, value: jobId },
    resultJson: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(resultData) },
  })
  await request.query(`
    UPDATE dbo.LibraryExtractionJobs
    SET status = 'done', result_json = @resultJson, completed_at = SYSUTCDATETIME()
    WHERE id = @id;
  `)
}

async function failExtractionJob(jobId, errorMessage) {
  const request = await withRequest({
    id: { type: sql.UniqueIdentifier, value: jobId },
    errorMessage: { type: sql.NVarChar(500), value: String(errorMessage || 'Bilinmeyen hata').slice(0, 500) },
  })
  await request.query(`
    UPDATE dbo.LibraryExtractionJobs
    SET status = 'error', error_message = @errorMessage, completed_at = SYSUTCDATETIME()
    WHERE id = @id;
  `)
}

async function getExtractionJob(jobId, actorUserId) {
  const request = await withRequest({
    id: { type: sql.UniqueIdentifier, value: jobId },
    actorUserId: { type: sql.UniqueIdentifier, value: actorUserId },
  })
  const result = await request.query(`
    SELECT id, job_type, status, result_json, error_message
    FROM dbo.LibraryExtractionJobs
    WHERE id = @id AND created_by_user_id = @actorUserId;
  `)
  return result.recordset[0] || null
}

// `work` çalışırken HTTP yanıtı zaten "jobId" ile dönmüş olur; bu fonksiyon yanıtı beklemeden
// arka planda çalışmaya devam eder ve bitince iş satırını günceller. Bu, App Service/Premium
// planında ya da yerel `func start` sürecinde güvenilir çalışır çünkü process yanıt sonrası
// canlı kalır. Consumption planına taşınırsa (process yanıt sonrası duraklatılabilir) bunun
// yerine bir Storage Queue trigger'ına geçmek gerekir — o zaman bu fonksiyon yerine kuyruğa
// mesaj basan bir eşdeğeri kullanılır, iş kaydı şeması aynı kalır.
function runExtractionJobInBackground(jobId, work) {
  work()
    .then((resultData) => completeExtractionJob(jobId, resultData))
    .catch((error) => {
      console.error('Extraction job failed', jobId, error)
      return failExtractionJob(jobId, error.message)
    })
    .catch((updateError) => {
      console.error('Extraction job status update failed', jobId, updateError)
    })
}

module.exports = {
  createExtractionJob,
  getExtractionJob,
  runExtractionJobInBackground,
}
