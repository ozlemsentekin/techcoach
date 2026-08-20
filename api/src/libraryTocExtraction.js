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

const TOC_EXTRACTION_PROMPT = `Bu görsel(ler) bir soru bankası / yardımcı kaynak kitabının "içindekiler" (fihrist) sayfalarıdır.
Kitaptaki içerik başlıklarını (ünite, bölüm, konu) ve altındaki testleri kitaptaki sırayla eksiksiz çıkar.

Her içerik (topic) için:
- name: içerik/ünite/bölüm başlığı (örn. "1. Ünite: Çarpanlar ve Katlar")

O içeriğin altındaki her test için:
- topicName: testin ait olduğu konu başlığı (içindekilerde ayrı bir alt başlık olarak yazıyorsa onu kullan, yoksa içerik adını kullan)
- name: test adı (örn. "Test 1", "Deneme 1", "Karma Test")
- pageStart: testin başladığı sayfa numarası (görselde tam sayı olarak yazan), yoksa null
- pageEnd: testin bittiği sayfa numarası, SADECE görselde açıkça bir sayfa aralığı (örn. "12-18") yazıyorsa doldur; aksi halde null bırak, tahmin/hesap yapma

Birden fazla görsel varsa hepsini kitabın baştan sona tek bir içindekiler listesi gibi sırayla birleştir. Sadece görsellerde açıkça yazan bilgileri aktar, yorum katma.`

function getAnthropicClient() {
  const { anthropicApiKey } = getAnthropicConfig()
  return new Anthropic({ apiKey: anthropicApiKey })
}

async function extractLibraryTocFromImages(images) {
  if (!Array.isArray(images) || !images.length) {
    return { error: 'En az bir içindekiler fotoğrafı yükleyin.' }
  }
  if (images.length > MAX_IMAGES) {
    return { error: `En fazla ${MAX_IMAGES} fotoğraf yükleyebilirsiniz.` }
  }

  const content = []
  for (const image of images) {
    const imageBase64 = image?.imageBase64
    const mediaType = image?.mediaType
    if (!imageBase64 || !ACCEPTED_MEDIA_TYPES.has(mediaType)) {
      return { error: 'Geçersiz görsel verisi.' }
    }
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } })
  }
  content.push({ type: 'text', text: TOC_EXTRACTION_PROMPT })

  const client = getAnthropicClient()
  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 8000,
    output_config: { format: { type: 'json_schema', schema: TOC_EXTRACTION_SCHEMA } },
    messages: [{ role: 'user', content }],
  })

  if (response.stop_reason === 'refusal') {
    return { error: 'Görseller işlenemedi (model isteği reddetti).' }
  }

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock) {
    return { error: 'Model beklenmeyen bir yanıt döndürdü.' }
  }

  const parsed = JSON.parse(textBlock.text)
  const topics = (parsed.topics || [])
    .map((topic) => ({
      name: (topic.name || '').trim(),
      tests: (topic.tests || [])
        .map((test) => ({
          topicName: (test.topicName || '').trim(),
          name: (test.name || '').trim(),
          pageStart: Number.isInteger(test.pageStart) ? test.pageStart : null,
          pageEnd: Number.isInteger(test.pageEnd) ? test.pageEnd : null,
        }))
        .filter((test) => test.topicName || test.name),
    }))
    .filter((topic) => topic.name && topic.tests.length)

  if (!topics.length) {
    return { error: 'Fotoğraflardan içerik/test bilgisi okunamadı. Elle girebilirsiniz.' }
  }

  return { topics }
}

module.exports = {
  extractLibraryTocFromImages,
}
