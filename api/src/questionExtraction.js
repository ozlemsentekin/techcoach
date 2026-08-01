const Anthropic = require('@anthropic-ai/sdk')
const { sql, withRequest } = require('./db')
const { getAnthropicConfig, isConfigError } = require('./config')
const { json } = require('./http')
const { requireAdmin } = require('./admin')

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          orderNo: { type: 'integer', description: 'Sayfada yazan soru numarası' },
          passageText: { type: 'string', description: 'Soruya ait okuma parçası/pasaj metni' },
          questionText: { type: 'string', description: 'Soru kökü (örn. "Bu metinde...")' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', description: 'A, B, C veya D' },
                text: { type: 'string' },
              },
              required: ['label', 'text'],
              additionalProperties: false,
            },
          },
        },
        required: ['orderNo', 'passageText', 'questionText', 'options'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
}

const EXTRACTION_PROMPT = `Bu görsel, bir Türkçe paragraf soru bankası kitabının bir sayfasıdır.
Görseldeki her çoktan seçmeli soruyu ayıkla. Her soru için:
- orderNo: sayfada yazan soru numarası (ör. "6." ise 6)
- passageText: sorunun dayandığı okuma parçası/pasaj (varsa tam metin, düzeltme yapmadan)
- questionText: soru kökü (ör. "Bu metinde aşağıdakilerden hangisine değinilmemiştir?")
- options: A, B, C, D şıklarının tam metni

Sadece görselde açıkça yazan metni aktar, yorum katma. El yazısı işaretlemeleri (doğru cevap işaretleri) YOK SAY — onları ayrıca başka bir kaynaktan alacağız, sadece soru metnini çıkar.`

function getAnthropicClient() {
  const { anthropicApiKey } = getAnthropicConfig()
  return new Anthropic({ apiKey: anthropicApiKey })
}

async function extractQuestionsFromImageHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const testId = request.params.testId
    const payload = await request.json().catch(() => null)
    const imageBase64 = payload?.imageBase64
    const mediaType = payload?.mediaType

    if (!imageBase64 || !mediaType) {
      return json(400, { error: 'Görsel verisi eksik.' })
    }

    const answerKeyRequestDb = await withRequest({
      testId: { type: sql.UniqueIdentifier, value: testId },
    })
    const answerKeyResult = await answerKeyRequestDb.query(`
      SELECT order_no, correct_label FROM dbo.TestAnswerKeys WHERE test_id = @testId;
    `)
    const correctLabelByOrderNo = new Map(
      answerKeyResult.recordset.map((row) => [row.order_no, row.correct_label.trim()]),
    )

    const client = getAnthropicClient()
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 8000,
      output_config: { format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
    })

    if (response.stop_reason === 'refusal') {
      return json(422, { error: 'Görsel işlenemedi (model isteği reddetti).' })
    }

    const textBlock = response.content.find((block) => block.type === 'text')
    if (!textBlock) {
      return json(500, { error: 'Model beklenmeyen bir yanıt döndürdü.' })
    }

    const parsed = JSON.parse(textBlock.text)

    const questions = parsed.questions.map((question) => {
      const correctLabel = correctLabelByOrderNo.get(question.orderNo) || null
      return {
        orderNo: question.orderNo,
        passageText: question.passageText,
        questionText: question.questionText,
        hasAnswerKeyMatch: Boolean(correctLabel),
        options: question.options.map((option) => ({
          label: option.label.trim().toUpperCase(),
          text: option.text,
          isCorrect: correctLabel ? option.label.trim().toUpperCase() === correctLabel : false,
        })),
      }
    })

    return json(200, { questions })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Yapay zeka servisi yapılandırması eksik.' })
    }

    console.error('extractQuestionsFromImageHandler failed', error)
    return json(500, { error: 'Görselden soru çıkarılamadı.' })
  }
}

module.exports = {
  extractQuestionsFromImageHandler,
}
