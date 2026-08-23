const Anthropic = require('@anthropic-ai/sdk')
const { sql, withRequest } = require('./db')
const { getAnthropicConfig, isConfigError } = require('./config')
const { json } = require('./http')
const { consumeRateLimit } = require('./rate-limit')
const { isSessionError, readSessionToken, verifySessionToken } = require('./security')

const MAX_MISTAKE_PHOTO_MB = 5
const MAX_MISTAKE_PHOTO_LENGTH = Math.ceil((MAX_MISTAKE_PHOTO_MB * 1024 * 1024 * 4) / 3)
const MISTAKE_PHOTO_DATA_URL_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i
const MISTAKE_PHOTO_DATA_URL_CAPTURE_PATTERN = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([a-z0-9+/=\s]+)$/i
const QUESTION_NUMBER_SCHEMA = {
  type: 'object',
  properties: {
    questionNumber: {
      type: ['integer', 'null'],
      description: 'Görselde ana sorunun yanında açıkça yazan soru numarası; emin değilsen null.',
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: 'Okunan numaraya ne kadar güvenildiği.',
    },
  },
  required: ['questionNumber', 'confidence'],
  additionalProperties: false,
}
const QUESTION_NUMBER_PROMPT = `Bu görsel bir soru bankası / test kitabındaki tek bir soru fotoğrafıdır.
Görselde ana sorunun başındaki basılı soru numarasını oku.

Kurallar:
- Sadece sorunun numarasını döndür (ör. "5." ise 5).
- Sayfa numarası, test numarası, şık harfleri, el yazısı/circle işaretleri ve cevap işaretlerini yok say.
- Birden fazla soru numarası görünüyorsa fotoğrafın ana/merkezdeki sorusuna ait olanı seç.
- Numara açıkça okunamıyorsa questionNumber null döndür.
- Tahmin etme.`

function getAnthropicClient() {
  const { anthropicApiKey } = getAnthropicConfig()
  return new Anthropic({ apiKey: anthropicApiKey })
}

function parseMistakePhotoDataUrl(photo) {
  const match = MISTAKE_PHOTO_DATA_URL_CAPTURE_PATTERN.exec(photo)
  if (!match) return null
  return {
    mediaType: match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase(),
    imageBase64: match[2].replace(/\s/g, ''),
  }
}

async function requireVerifiedPanelSession(request) {
  const token = readSessionToken(request)
  if (!token) {
    return { error: json(401, { error: 'Oturum bulunamadı.' }) }
  }

  const session = verifySessionToken(token)
  const requestDb = await withRequest({
    id: { type: sql.UniqueIdentifier, value: session.sub },
  })
  const result = await requestDb.query(`
    SELECT TOP 1 id, role, aydinlatma_accepted_at, kvkk_accepted_at
    FROM dbo.Users WHERE id = @id;
  `)
  const record = result.recordset[0]
  if (!record) {
    return { error: json(401, { error: 'Oturum geçersiz.' }) }
  }
  if (record.role !== 'ogretmen' && (!record.aydinlatma_accepted_at || !record.kvkk_accepted_at)) {
    return {
      error: json(403, {
        error: 'Devam etmek için KVKK ve aydınlatma metnini onaylamalısınız.',
        code: 'CONSENT_REQUIRED',
      }),
    }
  }

  return { userId: record.id, role: record.role }
}

function sanitizeMistakePhoto(value) {
  const photo = typeof value === 'string' ? value.trim() : ''
  if (!photo) return { error: 'Fotoğraf zorunludur.' }
  if (photo.length > MAX_MISTAKE_PHOTO_LENGTH) {
    return { error: `Fotoğraf çok büyük. En fazla ${MAX_MISTAKE_PHOTO_MB} MB olabilir, daha küçük bir görsel seçin.` }
  }
  if (!MISTAKE_PHOTO_DATA_URL_PATTERN.test(photo)) {
    return { error: 'Geçerli bir JPG/PNG/WEBP fotoğrafı yükleyin.' }
  }
  return { value: photo }
}

async function readQuestionNumberFromMistakePhoto(photo) {
  const photoCheck = sanitizeMistakePhoto(photo)
  if (photoCheck.error) {
    return { error: photoCheck.error }
  }

  const parsedPhoto = parseMistakePhotoDataUrl(photoCheck.value)
  if (!parsedPhoto) {
    return { error: 'Geçerli bir JPG/PNG/WEBP fotoğrafı yükleyin.' }
  }

  const client = getAnthropicClient()
  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 300,
    output_config: { format: { type: 'json_schema', schema: QUESTION_NUMBER_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: parsedPhoto.mediaType,
              data: parsedPhoto.imageBase64,
            },
          },
          { type: 'text', text: QUESTION_NUMBER_PROMPT },
        ],
      },
    ],
  })

  if (response.stop_reason === 'refusal') {
    return { error: 'Görsel işlenemedi.' }
  }

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock) {
    return { error: 'Görselden soru numarası okunamadı.' }
  }

  const parsed = JSON.parse(textBlock.text)
  const questionNumber = Number.isInteger(parsed.questionNumber) ? parsed.questionNumber : null
  const confidence = ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low'
  return { questionNumber, confidence }
}

async function verifyMistakePhotoQuestionNumberHandler(request) {
  try {
    const session = await requireVerifiedPanelSession(request)
    if (session.error) {
      return session.error
    }
    if (!(await consumeRateLimit(`mistake-photo-question-number:${session.userId}`, { maxRequests: 30 }))) {
      return json(429, { error: 'Çok fazla doğrulama denemesi yapıldı. Lütfen biraz sonra tekrar deneyin.' })
    }

    const payload = await request.json().catch(() => null)
    const expectedQuestionNumber = Number(payload?.expectedQuestionNumber)
    if (!Number.isInteger(expectedQuestionNumber) || expectedQuestionNumber < 1 || expectedQuestionNumber > 1000) {
      return json(400, { error: 'Geçerli bir soru numarası gönderin.' })
    }

    const result = await readQuestionNumberFromMistakePhoto(payload?.photo)
    if (result.error) {
      return json(422, { error: result.error })
    }

    const detectedQuestionNumber = result.confidence === 'low' ? null : result.questionNumber
    const status =
      detectedQuestionNumber === null
        ? 'unknown'
        : detectedQuestionNumber === expectedQuestionNumber
          ? 'matched'
          : 'mismatch'

    return json(200, {
      verification: {
        status,
        expectedQuestionNumber,
        detectedQuestionNumber,
        confidence: result.confidence,
      },
    })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Yapay zeka servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('verifyMistakePhotoQuestionNumberHandler failed', error)
    return json(500, { error: 'Soru numarası doğrulanamadı.' })
  }
}

const WRONG_QUESTION_OUTPUT_COLUMNS = `
  inserted.id, inserted.student_id, inserted.task_id, inserted.test_id, inserted.subject, inserted.topic,
  inserted.test_name, inserted.book_name, inserted.publisher_name, inserted.question_number,
  inserted.error_type, inserted.student_note, inserted.mistake_reason, inserted.review_status, inserted.resolved_at,
  inserted.photo_url, inserted.created_at
`

module.exports = {
  sanitizeMistakePhoto,
  verifyMistakePhotoQuestionNumberHandler,
  WRONG_QUESTION_OUTPUT_COLUMNS,
}
