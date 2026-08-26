const Anthropic = require('@anthropic-ai/sdk')
const { getAnthropicConfig } = require('./config')

const MAX_IMAGES = 8
const ACCEPTED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const TOC_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'İçerik/ünite/bölüm başlığı' },
          tests: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                topicName: { type: 'string', description: 'Testin ait olduğu konu başlığı' },
                name: { type: 'string', description: 'Test adı (örn. Test 1, Deneme 1, Karma Test)' },
                pageStart: { type: ['integer', 'null'], description: 'Başlangıç sayfa numarası, görselde yoksa null' },
                pageEnd: { type: ['integer', 'null'], description: 'Bitiş sayfa numarası, görselde açıkça yazmıyorsa null' },
              },
              required: ['topicName', 'name', 'pageStart', 'pageEnd'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'tests'],
        additionalProperties: false,
      },
    },
  },
  required: ['topics'],
  additionalProperties: false,
}

const TOC_EXTRACTION_PROMPT = `Bu görsel bir soru bankası / yardımcı kaynak kitabının "içindekiler" (fihrist) sayfasıdır (kitabın diğer sayfaları ayrı ayrı gönderiliyor, sadece bu sayfadakileri çıkar).
Sayfadaki içerik başlıklarını (ünite, bölüm, konu) ve altındaki testleri sayfadaki sırayla eksiksiz çıkar.

Her içerik (topic) için:
- name: içerik/ünite/bölüm başlığı (örn. "1. Ünite: Çarpanlar ve Katlar"). Bu sayfada yeni bir başlık yoksa (sayfa önceki sayfadaki bir bölümün devamıysa) en son geçerli başlığı kullan.

O içeriğin altındaki her test için:
- topicName: testin ait olduğu konu başlığı (içindekilerde ayrı bir alt başlık olarak yazıyorsa onu kullan, yoksa içerik adını kullan)
- name: test adı (örn. "Test 1", "Deneme 1", "Karma Test")
- pageStart: testin başladığı sayfa numarası (görselde tam sayı olarak yazan), yoksa null
- pageEnd: testin bittiği sayfa numarası, SADECE görselde açıkça bir sayfa aralığı (örn. "12-18") yazıyorsa doldur; aksi halde null bırak, tahmin/hesap yapma

Sadece görselde açıkça yazan bilgileri aktar, yorum katma.`

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

// Tek bir fotoğrafı model'e gönderir, ham (normalize edilmemiş) topics listesini döndürür.
// Görseller ayrı ayrı gönderilir (tek çağrıda birden fazla sayfa değil) ki hem daha hızlı
// yanıt alınsın hem de tek bir isteğin süresi platformun (Azure Static Web Apps Managed
// Functions) HTTP zaman aşımı sınırına yaklaşmasın.
async function extractTocFromSingleImage(image, imageIndex) {
  const imageBase64 = image?.imageBase64
  const mediaType = image?.mediaType
  if (!imageBase64 || !ACCEPTED_MEDIA_TYPES.has(mediaType)) {
    throw new Error(`${imageIndex + 1}. görsel geçersiz.`)
  }

  const client = getAnthropicClient()
  const stream = client.messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 8000,
    output_config: { format: { type: 'json_schema', schema: TOC_EXTRACTION_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: TOC_EXTRACTION_PROMPT },
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
    console.error('extractTocFromSingleImage truncated at max_tokens', { imageIndex })
    throw new Error(`${imageIndex + 1}. görseldeki içindekiler çok uzun, okunamadı.`)
  }

  try {
    const parsed = JSON.parse(textBlock.text)
    return parsed.topics || []
  } catch (parseError) {
    console.error('extractTocFromSingleImage JSON parse failed', parseError)
    throw new Error(`${imageIndex + 1}. görselin yanıtı okunamadı.`)
  }
}

// Görsel başına ayrı ayrı çıkarılan topics listelerini, görsel sırasına göre birleştirir.
// Aynı isimli bir içerik (örn. bir bölüm iki fotoğrafa yayılmışsa) tek bir topic altında
// toplanır, testleri sırayla eklenir.
function mergeTopicsAcrossImages(topicsPerImage) {
  const merged = []
  const indexByName = new Map()

  topicsPerImage.flat().forEach((rawTopic) => {
    const name = toTitleCase((rawTopic.name || '').trim())
    const tests = (rawTopic.tests || [])
      .map((test) => ({
        topicName: toTitleCase((test.topicName || '').trim()),
        name: (test.name || '').trim(),
        pageStart: Number.isInteger(test.pageStart) ? test.pageStart : null,
        pageEnd: Number.isInteger(test.pageEnd) ? test.pageEnd : null,
      }))
      .filter((test) => test.topicName || test.name)

    if (!name || !tests.length) return

    const key = name.toLocaleLowerCase('tr')
    if (indexByName.has(key)) {
      merged[indexByName.get(key)].tests.push(...tests)
    } else {
      indexByName.set(key, merged.length)
      merged.push({ name, tests })
    }
  })

  return merged
}

async function extractLibraryTocFromImages(images) {
  if (!Array.isArray(images) || !images.length) {
    return { error: 'En az bir içindekiler fotoğrafı yükleyin.' }
  }
  if (images.length > MAX_IMAGES) {
    return { error: `En fazla ${MAX_IMAGES} fotoğraf yükleyebilirsiniz.` }
  }

  let topicsPerImage
  try {
    topicsPerImage = await Promise.all(images.map((image, index) => extractTocFromSingleImage(image, index)))
  } catch (error) {
    return { error: error.message || 'İçindekiler okunamadı.' }
  }

  const topics = mergeTopicsAcrossImages(topicsPerImage)

  if (!topics.length) {
    return { error: 'Fotoğraflardan içerik/test bilgisi okunamadı. Elle girebilirsiniz.' }
  }

  return { topics }
}

module.exports = {
  extractLibraryTocFromImages,
}
