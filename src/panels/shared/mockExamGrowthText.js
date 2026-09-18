// "Deneme Gelişimi" için: backend'in ham sayım verisini (computeMockExamGrowthSummary)
// nötr, deterministik Türkçe cümlelere çevirir. AI yorumu / çıkarım YOK — yalnızca veride
// olan sayım ve oranlar cümleye dökülür. audience='self' (öğrenci, "sen" dili) ile
// audience='other' (veli/öğretmen, üçüncü şahıs) arasında yalnızca fiil çekimi değişir;
// hiçbir şablon yargılayıcı bir kelime ("başarısız", "yetersiz" vb.) içermez.
import { examMoodMeta, experienceTagLabel } from './mockExamConfig'

export function buildGrowthSentences(summary, { audience = 'self' } = {}) {
  if (!summary || summary.examCount < summary.minExams) return []

  const { examCount, tagCounts = [], previousActionReviewCounts, moodCounts = {} } = summary
  const verb = (self, other) => (audience === 'self' ? self : other)
  const sentences = []

  for (const { code, count } of tagCounts) {
    if (!count) continue
    const label = experienceTagLabel(code)
    sentences.push(
      `Son ${examCount} denemenin ${count}'sinde "${label}" durumunu ${verb('işaretledin', 'işaretledi')}.`,
    )
  }

  if (previousActionReviewCounts?.evet) {
    sentences.push(
      `Son ${examCount} denemede ${previousActionReviewCounts.evet} kez önceki hedefini uyguladığını ${verb(
        'belirttin',
        'belirtti',
      )}.`,
    )
  }
  if (previousActionReviewCounts?.kismen) {
    sentences.push(
      `Son ${examCount} denemede ${previousActionReviewCounts.kismen} kez önceki hedefini kısmen uyguladığını ${verb(
        'belirttin',
        'belirtti',
      )}.`,
    )
  }

  const topMoodEntry = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]
  if (topMoodEntry) {
    const [moodValue, moodCount] = topMoodEntry
    const meta = examMoodMeta(moodValue)
    if (meta) {
      sentences.push(
        `Son ${examCount} denemenin ${moodCount}'sinde "${meta.label}" hissini ${verb('seçtin', 'seçti')}.`,
      )
    }
  }

  return sentences
}
