// Türkçe ekleri isme sesli uyumuna göre ekleyen yardımcılar.
// Örn. Aylin'in, Yağmur'un, Ozan'ın, Ayşe'nin, Ali'nin

const VOWELS = 'aeıioöuüAEIİOÖUÜ'

const FRONT = 'eiöüEİÖÜ'
const ROUND = 'oöuüOÖUÜ'

/** Kelimedeki son sesli harfi döndürür (küçük harfe çevrilmiş). */
function lastVowel(word) {
  for (let i = word.length - 1; i >= 0; i -= 1) {
    const ch = word[i]
    if (VOWELS.includes(ch)) {
      return ch === 'I' ? 'ı' : ch === 'İ' ? 'i' : ch.toLocaleLowerCase('tr')
    }
  }
  return null
}

function endsWithVowel(word) {
  const ch = word[word.length - 1]
  return !!ch && VOWELS.includes(ch)
}

/**
 * İsmin ilgi hâli ekini (Türkçe genitif: -in/-ın/-un/-ün, sesliyle bitince -nin/-nın/-nun/-nün)
 * kesme işaretiyle birlikte döndürür. Örn. genitiveSuffix('Yağmur') === "'un"
 */
export function genitiveSuffix(name) {
  const word = String(name || '').trim()
  if (!word) return ''

  const v = lastVowel(word)
  let vowel
  if (!v) {
    vowel = 'i'
  } else if (FRONT.includes(v)) {
    vowel = ROUND.includes(v) ? 'ü' : 'i'
  } else {
    vowel = ROUND.includes(v) ? 'u' : 'ı'
  }

  const buffer = endsWithVowel(word) ? 'n' : ''
  return `'${buffer}${vowel}n`
}

/** İsmi ilgi hâline getirir. Örn. withGenitive('Ozan') === "Ozan'ın" */
export function withGenitive(name) {
  const word = String(name || '').trim()
  return word ? `${word}${genitiveSuffix(word)}` : word
}
