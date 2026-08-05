import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, BookOpen, X } from 'lucide-react'
import { getWrongQuestions } from '../../../services/wrongQuestionService'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import Button from '../../ui/Button'
import Badge from '../../ui/Badge'
import DataTable from '../../ui/DataTable'
import { MotionDiv } from '../../ui/motion'

const SHELF_TONES = [
  'border-panel-blue bg-panel-blue-soft',
  'border-panel-lilac bg-panel-lilac-soft',
  'border-panel-sage bg-panel-sage-soft',
  'border-panel-warm bg-panel-accent-soft',
  'border-panel-slate bg-panel-slate-soft',
]

function groupBySubject(wrongQuestions) {
  const bySubject = {}
  wrongQuestions.forEach((item) => {
    if (!item.photoUrl) return
    if (!bySubject[item.subject]) {
      bySubject[item.subject] = { subject: item.subject, items: [] }
    }
    bySubject[item.subject].items.push(item)
  })
  return Object.values(bySubject).sort((a, b) => b.items.length - a.items.length)
}

function SubjectShelfCard({ subject, count, tone, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-3 rounded-2xl border-l-[6px] p-4 text-left shadow-sm transition-transform hover:-translate-y-0.5 ${tone}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 text-panel-text">
        <BookOpen size={20} aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-panel-text">{subject}</h3>
        <p className="text-sm text-panel-text-muted">{count} soru</p>
      </div>
    </button>
  )
}

function PhotoLightbox({ photoUrl, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Soru fotoğrafı"
      onClick={onClose}
    >
      <div className="relative max-h-[90vh] max-w-3xl" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          aria-label="Kapat"
          onClick={onClose}
          className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-panel-text shadow-lg"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <img src={photoUrl} alt="Soru fotoğrafı" className="max-h-[90vh] max-w-full rounded-2xl object-contain shadow-2xl" />
      </div>
    </div>
  )
}

export default function MistakesPage() {
  const [wrongQuestions, setWrongQuestions] = useState(null)
  const [error, setError] = useState('')
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [lightboxPhoto, setLightboxPhoto] = useState(null)

  useEffect(() => {
    let ignore = false
    getWrongQuestions()
      .then((data) => {
        if (!ignore) setWrongQuestions(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [])

  const groups = useMemo(() => (wrongQuestions ? groupBySubject(wrongQuestions) : []), [wrongQuestions])
  const selectedGroup = groups.find((group) => group.subject === selectedSubject) || null

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      {selectedGroup ? (
        <PageHeader
          title={selectedGroup.subject}
          subtitle={`${selectedGroup.items.length} yanlış soru`}
          actions={
            <Button variant="secondary" onClick={() => setSelectedSubject(null)}>
              <ArrowLeft size={15} aria-hidden="true" />
              Derslere Dön
            </Button>
          }
        />
      ) : (
        <PageHeader title="Hata Defterim" subtitle="Fotoğrafını çektiğin yanlış sorular ders ders burada." />
      )}

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : wrongQuestions === null ? (
        <LoadingState label="Hata defteri yükleniyor..." />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="Henüz fotoğraflanmış yanlışın yok"
          description="Cevap kağıdında yanlış işaretlenen bir soruya tıklayıp fotoğrafını eklediğinde burada görünecek."
        />
      ) : selectedGroup ? (
        <MotionDiv initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <DataTable>
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="bg-[#f8f7fb] text-[13px] font-semibold text-[#655e94]">
                  <th className="px-4 py-3">Yayın Evi</th>
                  <th className="px-4 py-3">Kitap</th>
                  <th className="px-4 py-3">Konu</th>
                  <th className="px-4 py-3">Test</th>
                  <th className="px-4 py-3 text-center">Soru No</th>
                  <th className="px-4 py-3 text-right">Fotoğraf</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0f1]">
                {selectedGroup.items.map((item) => (
                  <tr key={item.id} className="hover:bg-[#f8f7fb]">
                    <td className="px-4 py-3 text-sm text-[#253d3e]">{item.publisherName || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#253d3e]">{item.bookName || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#667475]">{item.topic || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#667475]">{item.testName || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge tone="warm">{item.questionNumber}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="secondary" size="sm" onClick={() => setLightboxPhoto(item.photoUrl)}>
                        Soruyu Gör
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        </MotionDiv>
      ) : (
        <MotionDiv
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {groups.map((group, index) => (
            <SubjectShelfCard
              key={group.subject}
              subject={group.subject}
              count={group.items.length}
              tone={SHELF_TONES[index % SHELF_TONES.length]}
              onClick={() => setSelectedSubject(group.subject)}
            />
          ))}
        </MotionDiv>
      )}

      {lightboxPhoto ? <PhotoLightbox photoUrl={lightboxPhoto} onClose={() => setLightboxPhoto(null)} /> : null}
    </div>
  )
}
