const Anthropic = require('@anthropic-ai/sdk')
const { getAnthropicConfig } = require('./config')

const MAX_IMAGES = 8
const ACCEPTED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const ANSWER_KEY_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    tests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topicName: { type: ['string', 'null'], description: 'Testin ait olduğu içerik/ünite başlığı, görselde ayrıca yazmıyorsa null' },
          testName: { type: 'string', description: 'Test adı (örn. Test 1, Deneme 1, Karma Test) — fihristteki yazımla birebir aynı' },
          questionCount: { type: 'integer', description: 'O testin cevaplarının kapsadığı en yüksek soru numarası (toplam soru sayısı)' },
        },
        required: ['topicName', 'testName', 'questionCount'],
        additionalProperties: false,
      },
    },
  },
  required: ['tests'],
  additionalProperties: false,
}

const ANSWER_KEY_EXTRACTION_PROMPT = `Bu görsel bir soru bankası kitabının "cevap anahtarı" sayfasıdır (kitabın diğer cevap anahtarı sayfaları ayrı ayrı gönderiliyor, sadece bu sayfadakileri çıkar).
Sayfadaki her test/bölüm başlığı için, o testte kaç soru cevaplandığını (en yüksek soru numarasını) çıkar.

Her kayıt için:
- topicName: testin ait olduğu içerik/ünite başlığı (cevap anahtarında ayrıca yazıyorsa), yoksa null
- testName: test adı (örn. "Test 1", "Deneme 1", "Karma Test") — kitaptaki fihrist/içindekiler adlandırmasıyla birebir aynı yazımda aktar
- questionCount: o testin cevaplarının kapsadığı en yüksek soru numarası (toplam soru sayısı)

Sadece görselde açıkça yazan bilgileri aktar, tahmin/yorum katma.`

// Model içerik/bölüm başlıklarını genelde büyük harfle döndürüyor (örn. "1. BÖLÜM: GÖRSEL OKUMA").
// Standardımız her kelimenin baş harfi büyük, gerisi küçük ("1. Bölüm: Görsel Okuma").
function toTitleCase(text) {
  return text
    .split(' ')
    .map((word) => {
      const lower = word.toLocaleLowerCase('tr')
      const firstLetterIndex = lower.search(/\p{L}/u)
      if (firstLetterIndex === -1) return lower
      return (
        lower.slice(0, firstLetterIndex) +
        lower[firstLetterIndex].toLocaleUpperCase('tr') +
        lower.slice(firstLetterIndex + 1)
      )
    })
    .join(' ')
}

function getAnthropicClient() {
  const { anthropicApiKey } = getAnthropicConfig()
  return new Anthropic({ apiKey: anthropicApiKey, maxRetries: 1 })
}

// Tek bir fotoğrafı model'e gönderir, ham (normalize edilmemiş) tests listesini döndürür.
// Görseller ayrı ayrı gönderilir (tek çağrıda birden fazla sayfa değil) ki hem daha hızlı
// yanıt alınsın hem de tek bir isteğin süresi platformun (Azure Static Web Apps Managed
// Functions) HTTP zaman aşımı sınırına yaklaşmasın.
async function extractAnswerKeyFromSingleImage(image, imageIndex) {
  const imageBase64 = image?.imageBase64
  const mediaType = image?.mediaType
  if (!imageBase64 || !ACCEPTED_MEDIA_TYPES.has(mediaType)) {
    throw new Error(`${imageIndex + 1}. görsel geçersiz.`)
  }

  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 8000,
    output_config: { format: { type: 'json_schema', schema: ANSWER_KEY_EXTRACTION_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: ANSWER_KEY_EXTRACTION_PROMPT },
        ],
      },
    ],
  })
  const response = await stream.finalMessage()

  if (response.stop_reason === 'refusal') {
    throw new Error(`${imageIndex + 1}. görsel işlenemedi (model isteği reddetti).`)
  }

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock) {
    throw new Error(`${imageIndex + 1}. görsel için model beklenmeyen bir yanıt döndürdü.`)
  }

  if (response.stop_reason === 'max_tokens') {
    console.error('extractAnswerKeyFromSingleImage truncated at max_tokens', { imageIndex })
    throw new Error(`${imageIndex + 1}. görseldeki cevap anahtarı çok uzun, okunamadı.`)
  }

  try {
    const parsed = JSON.parse(textBlock.text)
    return parsed.tests || []
  } catch (parseError) {
    console.error('extractAnswerKeyFromSingleImage JSON parse failed', parseError)
    throw new Error(`${imageIndex + 1}. görselin yanıtı okunamadı.`)
  }
}

async function extractLibraryAnswerKeyFromImages(images) {
  if (!Array.isArray(images) || !images.length) {
    return { error: 'En az bir cevap anahtarı fotoğrafı yükleyin.' }
  }
  if (images.length > MAX_IMAGES) {
    return { error: `En fazla ${MAX_IMAGES} fotoğraf yükleyebilirsiniz.` }
  }

  let testsPerImage
  try {
    testsPerImage = await Promise.all(images.map((image, index) => extractAnswerKeyFromSingleImage(image, index)))
  } catch (error) {
    return { error: error.message || 'Cevap anahtarı okunamadı.' }
  }

  const tests = testsPerImage
    .flat()
    .map((test) => ({
      topicName: toTitleCase((test.topicName || '').trim()) || null,
      testName: (test.testName || '').trim(),
      questionCount: Number.isInteger(test.questionCount) && test.questionCount > 0 ? test.questionCount : null,
    }))
    .filter((test) => test.testName && test.questionCount)

  if (!tests.length) {
    return { error: 'Cevap anahtarından soru sayısı okunamadı. Elle girebilirsiniz.' }
  }

  return { tests }
}

module.exports = {
  extractLibraryAnswerKeyFromImages,
}
