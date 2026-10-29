const crypto = require('crypto')
const {
  BlobServiceClient,
  BlobSASPermissions,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} = require('@azure/storage-blob')
const { getBlobConfig } = require('./config')

// Fotoğraflar eskiden base64 data URL olarak doğrudan veritabanı kolonuna yazılıyordu (WrongQuestions
// tek başına ~760 MB'a çıktı, S0 bu satırları okurken yavaşlıyor). Artık dosya Azure Blob'a yüklenir,
// kolona yalnızca "azblob:<container>/<yol>" referansı yazılır. Okurken referans kısa ömürlü,
// salt-okunur bir SAS adresine çevrilir. Eski data URL kayıtlar olduğu gibi döner (bkz.
// scripts/migrate-wrong-question-photos-to-blob.js).
const BLOB_REF_PREFIX = 'azblob:'
const WRONG_QUESTION_PHOTOS_CONTAINER = 'wrong-question-photos'
const CONTAINERS = {
  wrongQuestionPhotos: WRONG_QUESTION_PHOTOS_CONTAINER,
  panelRequestPhotos: 'panel-request-photos',
  lessonNotes: 'lesson-notes',
  schoolResources: 'school-resources',
  taskAttachments: 'task-attachments',
}
// Üye silinince öğrenci id'si klasörü temizlenen klasörler (bkz. admin deleteUserHandler).
const STUDENT_SCOPED_CONTAINERS = [CONTAINERS.wrongQuestionPhotos, CONTAINERS.taskAttachments]
// SAS bitişi 15 dakikalık dilimlere yuvarlanır: aynı dilimde aynı adres üretilir, tarayıcı önbelleği çalışır.
const SAS_WINDOW_MS = 15 * 60 * 1000
const DATA_URL_PATTERN = /^data:([^;,]+);base64,(.+)$/s
const EXTENSION_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

let cachedClient = null

function getBlobClients() {
  const { blobConnectionString } = getBlobConfig()
  if (!blobConnectionString) return null
  if (cachedClient?.connectionString === blobConnectionString) return cachedClient

  const parts = Object.fromEntries(
    blobConnectionString.split(';').filter(Boolean).map((part) => {
      const index = part.indexOf('=')
      return [part.slice(0, index), part.slice(index + 1)]
    }),
  )
  cachedClient = {
    connectionString: blobConnectionString,
    service: BlobServiceClient.fromConnectionString(blobConnectionString),
    credential: new StorageSharedKeyCredential(parts.AccountName, parts.AccountKey),
  }
  return cachedClient
}

function isBlobConfigured() {
  return Boolean(getBlobClients())
}

function isBlobRef(value) {
  return typeof value === 'string' && value.startsWith(BLOB_REF_PREFIX)
}

function parseBlobRef(value) {
  if (!isBlobRef(value)) return null
  const rest = value.slice(BLOB_REF_PREFIX.length)
  const slash = rest.indexOf('/')
  if (slash <= 0) return null
  return { container: rest.slice(0, slash), blobName: rest.slice(slash + 1) }
}

/**
 * Data URL'yi depoya yükler ve kolona yazılacak referansı döner. Depo tanımlı değilse ya da değer
 * data URL değilse değeri olduğu gibi döner (eski davranış).
 * `prefix` genelde öğrenci id'sidir: üye silinince o öğrencinin dosyaları topluca silinebilsin.
 */
async function storeDataUrl(dataUrl, { container = WRONG_QUESTION_PHOTOS_CONTAINER, prefix } = {}) {
  const clients = getBlobClients()
  const match = typeof dataUrl === 'string' ? DATA_URL_PATTERN.exec(dataUrl) : null
  if (!clients || !match) return dataUrl

  const contentType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase()
  const extension = EXTENSION_BY_TYPE[contentType] || 'bin'
  const blobName = `${prefix ? `${String(prefix).toLowerCase()}/` : ''}${crypto.randomUUID()}.${extension}`
  const body = Buffer.from(match[2].replace(/\s/g, ''), 'base64')

  await clients.service
    .getContainerClient(container)
    .getBlockBlobClient(blobName)
    .uploadData(body, { blobHTTPHeaders: { blobContentType: contentType, blobCacheControl: 'private, max-age=900' } })

  return `${BLOB_REF_PREFIX}${container}/${blobName}`
}

/**
 * Bu depo hesabının SAS/düz adresini (istemcinin bir düzenleme formunda geri gönderdiği) kolona
 * yazılacak referansa çevirir. Adres başka bir yere aitse ya da `container` tutmuyorsa null.
 */
function refFromReadUrl(url, container) {
  const clients = getBlobClients()
  if (!clients || typeof url !== 'string') return null
  const base = clients.service.url.endsWith('/') ? clients.service.url : `${clients.service.url}/`
  const prefix = `${base}${container}/`
  if (!url.startsWith(prefix)) return null
  const blobName = decodeURIComponent(url.slice(prefix.length).split('?')[0])
  return blobName ? `${BLOB_REF_PREFIX}${container}/${blobName}` : null
}

/**
 * İstemciden gelen bir dosya değerini kolona yazılacak hale getirir: data URL → depoya yüklenir,
 * bu klasörün SAS adresi / referansı → referans, diğer (dış https) adresler aynen.
 */
async function toStoredValue(value, { container, prefix } = {}) {
  if (typeof value !== 'string' || !value) return value
  if (value.startsWith('data:')) return storeDataUrl(value, { container, prefix })
  if (isBlobRef(value)) return parseBlobRef(value)?.container === container ? value : null
  return refFromReadUrl(value, container) || value
}

/** Referans ya da data URL'nin içerik türü (uzantıdan); bilinmiyorsa undefined. */
function storedMimeType(value) {
  if (typeof value !== 'string') return undefined
  const dataMatch = /^data:([^;,]+)/.exec(value)
  if (dataMatch) return dataMatch[1]
  const ref = parseBlobRef(value)
  if (!ref) return undefined
  const extension = ref.blobName.split('.').pop().toLowerCase()
  return Object.entries(EXTENSION_BY_TYPE).find(([, ext]) => ext === extension)?.[0]
}

/** Kolondaki değeri istemciye verilecek adrese çevirir: referans → SAS adresi, diğerleri aynen. */
function toReadUrl(value) {
  const ref = parseBlobRef(value)
  if (!ref) return value
  const clients = getBlobClients()
  if (!clients) return null

  const expiresOn = new Date((Math.floor(Date.now() / SAS_WINDOW_MS) + 2) * SAS_WINDOW_MS)
  const sas = generateBlobSASQueryParameters(
    {
      containerName: ref.container,
      blobName: ref.blobName,
      permissions: BlobSASPermissions.parse('r'),
      expiresOn,
    },
    clients.credential,
  ).toString()
  const blobUrl = clients.service.getContainerClient(ref.container).getBlobClient(ref.blobName).url
  return `${blobUrl}?${sas}`
}

/** Referansın gösterdiği dosyanın içeriğini data URL olarak döner (sunucu tarafında bayt gereken yerler için). */
async function readAsDataUrl(value) {
  const ref = parseBlobRef(value)
  if (!ref) return value
  const clients = getBlobClients()
  if (!clients) return null
  const blobClient = clients.service.getContainerClient(ref.container).getBlobClient(ref.blobName)
  const [buffer, properties] = await Promise.all([blobClient.downloadToBuffer(), blobClient.getProperties()])
  return `data:${properties.contentType || 'application/octet-stream'};base64,${buffer.toString('base64')}`
}

/** Tek bir referansın dosyasını siler; hata yutulur (silinmiş dosyalar 7 gün geri alınabilir). */
async function deleteBlobRef(value) {
  const ref = parseBlobRef(value)
  const clients = getBlobClients()
  if (!ref || !clients) return
  try {
    await clients.service.getContainerClient(ref.container).deleteBlob(ref.blobName, { deleteSnapshots: 'include' })
  } catch (error) {
    if (error.statusCode !== 404) console.warn('deleteBlobRef failed', error.message)
  }
}

/** Bir öğrencinin (prefix) depodaki tüm dosyalarını siler — üye silme cascade'i için. */
async function deleteBlobsWithPrefix(prefix, { container = WRONG_QUESTION_PHOTOS_CONTAINER } = {}) {
  const clients = getBlobClients()
  if (!clients || !prefix) return 0
  const containerClient = clients.service.getContainerClient(container)
  let deleted = 0
  for await (const blob of containerClient.listBlobsFlat({ prefix: `${String(prefix).toLowerCase()}/` })) {
    await containerClient.deleteBlob(blob.name, { deleteSnapshots: 'include' }).catch(() => {})
    deleted += 1
  }
  return deleted
}

module.exports = {
  BLOB_REF_PREFIX,
  WRONG_QUESTION_PHOTOS_CONTAINER,
  CONTAINERS,
  STUDENT_SCOPED_CONTAINERS,
  parseBlobRef,
  refFromReadUrl,
  toStoredValue,
  storedMimeType,
  isBlobConfigured,
  isBlobRef,
  storeDataUrl,
  toReadUrl,
  readAsDataUrl,
  deleteBlobRef,
  deleteBlobsWithPrefix,
}
