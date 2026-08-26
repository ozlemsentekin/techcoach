const Anthropic = require('@anthropic-ai/sdk')
const { getAnthropicConfig } = require('./config')

const ACCEPTED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const COVER_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: ['string', 'null'], description: 'Kapakta yazan kitap/kaynak adı, okunamıyorsa null' },
    publisherName: { type: ['string', 'null'], description: 'Kapakta yazan yayınevi adı, okunamıyorsa null' },
    barcode: { type: ['string', 'null'], description: 'Kapakta görünen barkod numarası, yoksa null' },
    publishYear: { type: ['integer', 'null'], description: 'Kapakta açıkça yazan basım yılı, yoksa null' },
    resourceType: {
      anyOf: [{ type: 'string', enum: ['soru_bankasi', 'konu_anlatimi'] }, { type: 'null' }],
      description:
        'Kapakta "konu anlatımlı/konu anlatımı" ifadesi varsa konu_anlatimi, "soru bankası" ön plandaysa soru_bankasi, emin değilsen null',
    },
  },
  required: ['name', 'publisherName', 'barcode', 'publishYear', 'resourceType'],
  additionalProperties: false,
}

const COVER_EXTRACTION_PROMPT = `Bu görsel bir soru bankası / yardımcı kaynak kitabının ön kapak fotoğrafıdır.
Sadece kapakta açıkça basılı/yazılı olan bilgileri çıkar, tahmin veya yorum katma; emin olmadığın alanı null bırak.

- name: kitabın/kaynağın adı
- publisherName: yayınevi adı
- barcode: kapakta görünen barkod numarası (varsa)
- publishYear: kapakta açıkça yazan basım yılı (varsa)
- resourceType: kapakta "konu anlatımlı" veya "konu anlatımı" ifadesi geçiyorsa konu_anlatimi, "soru bankası" ifadesi ön plandaysa soru_bankasi, aksi halde null`

function getAnthropicClient() {
  const { anthropicApiKey } = getAnthropicConfig()
  return new Anthropic({ apiKey: anthropicApiKey, maxRetries: 1 })
}

async function extractLibraryCoverInfo(image) {
  const imageBase64 = image?.imageBase64
  const mediaType = image?.mediaType
  if (!imageBase64 || !ACCEPTED_MEDIA_TYPES.has(mediaType)) {
    return { error: 'Geçersiz görsel verisi.' }
  }

  const client = getAnthropicClient()
  const response = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1000,
    output_config: { format: { type: 'json_schema', schema: COVER_EXTRACTION_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: COVER_EXTRACTION_PROMPT },
        ],
      },
    ],
  })

  if (response.stop_reason === 'refusal') {
    return { error: 'Görsel işlenemedi (model isteği reddetti).' }
  }

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock) {
    return { error: 'Model beklenmeyen bir yanıt döndürdü.' }
  }

  const parsed = JSON.parse(textBlock.text)
  return {
    name: parsed.name?.trim() || null,
    publisherName: parsed.publisherName?.trim() || null,
    barcode: parsed.barcode?.trim() || null,
    publishYear: Number.isInteger(parsed.publishYear) ? parsed.publishYear : null,
    resourceType: ['soru_bankasi', 'konu_anlatimi'].includes(parsed.resourceType) ? parsed.resourceType : null,
  }
}

module.exports = {
  extractLibraryCoverInfo,
}
