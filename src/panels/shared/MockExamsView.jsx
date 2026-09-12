import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileCheck2,
  ImagePlus,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Timer,
  Trash2,
  X,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import PageHeader from '../layout/PageHeader'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'
import Button from '../ui/Button'
import ConfirmationDialog from './ConfirmationDialog'
import { cn } from '../ui/utils'
import { cachedGet } from '../../services/authClient'
import { todayISODate } from '../../utils/time'
import MistakePhotoCaptureModal from '../student/components/MistakePhotoCaptureModal'
import MockExamTopicAnalysis from './MockExamTopicAnalysis'
import {
  BRANS_QUESTION_COUNT,
  GENEL_DENEME_TEMPLATE,
  MAX_ETUT_QUESTIONS,
  MOCK_EXAM_KINDS,
  computeNet,
  gradeEightSubjects,
  matchSubjectId,
  mockExamKindLabel,
  subjectTone,
} from './mockExamConfig'

const DATE_FMT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })

function formatExamDate(value) {
  if (!value) return 'Tarihsiz'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : DATE_FMT.format(date)
}

// Puan/sıra/ortalama alanı boş string veya sayı-olmayan bir şey ise gönderilmez (undefined) —
// sunucu tarafı bunu "alan girilmedi" olarak yorumlar, mevcut değeri sıfırlamaz.
function toNumOrUndef(text) {
  if (text === '' || text == null) return undefined
  const n = Number(text)
  return Number.isFinite(n) ? n : undefined
}

function successTone(percent) {
  if (percent >= 85) return 'bg-panel-green-soft text-panel-green'
  if (percent >= 60) return 'bg-panel-yellow-soft text-panel-yellow'
  return 'bg-panel-red-soft text-panel-red'
}

function StatPill({ label, value, tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold tabular-nums',
        tone || 'bg-panel-surface-soft text-panel-text-muted',
      )}
    >
      <span className="font-medium opacity-70">{label}</span>
      {value}
    </span>
  )
}

const KIND_ICONS = { brans: FileCheck2, genel: LayoutGrid, etut: Timer }

const FIELD_CLASS =
  'w-full rounded-xl border border-panel-border bg-white p-3 text-base text-panel-text shadow-sm outline-none transition-colors focus:border-panel-blue focus:ring-2 focus:ring-panel-blue-soft'

// Sadece rakam kabul eden, baştaki sıfırları yiyen sayı girişi ("028" yazılamaz).
// value 0 iken placeholder görünür (alan adı soluk yazıyla input içinde durur).
function NumberField({ value, onChange, max, className, placeholder = '0', ...props }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value === 0 ? '' : String(value)}
      placeholder={placeholder}
      onChange={(event) => {
        const digits = event.target.value.replace(/[^0-9]/g, '')
        let next = digits === '' ? 0 : Number.parseInt(digits, 10)
        if (Number.isNaN(next)) next = 0
        if (max != null) next = Math.min(max, next)
        onChange(next)
      }}
      className={className}
      {...props}
    />
  )
}

// type="date" placeholder gösteremediği için: değer yokken metin kutusu gibi görünür
// (placeholder = alan adı), odaklanınca tarih seçiciye döner.
function DateField({ value, onChange, placeholder }) {
  const [active, setActive] = useState(false)
  return (
    <input
      type={active || value ? 'date' : 'text'}
      value={value || ''}
      placeholder={placeholder}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      onChange={(event) => onChange(event.target.value)}
      className={cn(FIELD_CLASS, 'p-2.5 text-sm', !value && 'text-panel-text-muted')}
    />
  )
}

// Puan/sıra/ortalama girişi: serbest metin olarak tutulur (yazarken virgülü noktaya çevirir),
// sayıya çevirme yalnızca gönderim anında yapılır — yazarken "86." gibi ara durumlar bozulmaz.
function DetailField({ label, value, onChange }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-panel-text-muted">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
        className={cn(FIELD_CLASS, 'p-1.5 text-center text-xs tabular-nums')}
      />
    </label>
  )
}

/* ------------------------------------------------------------------ D/Y/B satırı */

const NUM_CLASS = cn(
  FIELD_CLASS,
  'w-full p-2 text-center text-sm tabular-nums placeholder:font-medium placeholder:text-xs',
)

// Doğru / yanlış / boş — tek satırda, etiketsiz (alan adları input içinde soluk placeholder).
// total null ise (Etüt) toplam = D+Y+B; sabit toplam yoktur.
function CountsRow({ total, counts, name, onCount, readOnly = false }) {
  const sum = counts.correct + counts.wrong + counts.blank
  const fixed = total != null
  const matched = fixed ? sum === total : sum >= 1
  return (
    <div className="flex flex-wrap items-center gap-2">
      {name ? (
        <span className="min-w-[6.5rem] flex-1 truncate text-sm font-semibold text-panel-text">{name}</span>
      ) : null}
      <div className="grid flex-1 grid-cols-3 gap-2">
        <NumberField
          value={counts.correct}
          max={total ?? undefined}
          placeholder="Doğru"
          disabled={readOnly}
          onChange={(next) => onCount('correct', next)}
          className={cn(NUM_CLASS, 'placeholder:text-panel-green/60', readOnly && 'opacity-70')}
        />
        <NumberField
          value={counts.wrong}
          max={total ?? undefined}
          placeholder="Yanlış"
          disabled={readOnly}
          onChange={(next) => onCount('wrong', next)}
          className={cn(NUM_CLASS, 'placeholder:text-panel-red/60', readOnly && 'opacity-70')}
        />
        <NumberField
          value={counts.blank}
          max={total ?? undefined}
          placeholder="Boş"
          disabled={readOnly}
          onChange={(next) => onCount('blank', next)}
          className={cn(NUM_CLASS, 'placeholder:text-panel-text-muted/70', readOnly && 'opacity-70')}
        />
      </div>
      <span
        className={cn(
          'shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold tabular-nums',
          matched ? 'bg-panel-green-soft text-panel-green' : 'bg-panel-accent-soft text-panel-warm',
        )}
      >
        {fixed ? `${sum}/${total}` : `${sum} soru`}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ soru bazlı giriş */

const QUESTION_STATUS_META = {
  dogru: { label: 'D', tone: 'bg-panel-green-soft text-panel-green', activeTone: 'bg-panel-green text-white' },
  yanlis: { label: 'Y', tone: 'bg-panel-red-soft text-panel-red', activeTone: 'bg-panel-red text-white' },
  bos: { label: 'B', tone: 'bg-panel-surface-soft text-panel-text-muted', activeTone: 'bg-panel-text-muted text-white' },
}

function defaultQuestionRow(orderNo) {
  return { orderNo, status: 'bos', topicName: '' }
}

function QuestionStatusToggle({ value, onChange }) {
  return (
    <div className="flex shrink-0 gap-1">
      {Object.entries(QUESTION_STATUS_META).map(([key, meta]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition-colors',
            value === key ? meta.activeTone : meta.tone,
          )}
        >
          {meta.label}
        </button>
      ))}
    </div>
  )
}

// Soru bazlı giriş: her soru için durum (D/Y/B) + konu adı. editableTotal true ise (Etüt)
// soru sayısı sonradan +/- ile değiştirilebilir; sabit toplamlı türlerde (Genel/Branş) satır
// sayısı total'a kilitlidir.
function QuestionRows({ idPrefix, questions, editableTotal, suggestions, onPatch, onAdd, onRemove }) {
  return (
    <div className="flex flex-col gap-1.5">
      <datalist id={idPrefix}>
        {suggestions.map((topic) => (
          <option key={topic} value={topic} />
        ))}
      </datalist>
      {questions.map((q, qi) => (
        <div key={qi} className="flex items-center gap-1.5">
          <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-panel-text-muted">
            {q.orderNo}
          </span>
          <QuestionStatusToggle value={q.status} onChange={(status) => onPatch(qi, { status })} />
          <input
            type="text"
            list={idPrefix}
            value={q.topicName}
            onChange={(event) => onPatch(qi, { topicName: event.target.value })}
            placeholder="Konu (isteğe bağlı)"
            maxLength={200}
            className="h-8 min-w-0 flex-1 rounded-lg border border-panel-border bg-white px-2 text-xs text-panel-text placeholder:text-panel-text-muted/70"
          />
        </div>
      ))}
      {editableTotal ? (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onAdd}
            className="rounded-lg border border-dashed border-panel-blue/50 px-2 py-1 text-xs font-semibold text-panel-blue hover:bg-panel-blue-soft"
          >
            + Soru ekle
          </button>
          {questions.length > 1 ? (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg border border-dashed border-panel-red/40 px-2 py-1 text-xs font-semibold text-panel-red hover:bg-panel-red-soft"
            >
              Son soruyu sil
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ Yeni / düzenle çekmecesi */

const emptyCounts = { correct: 0, wrong: 0, blank: 0 }

// Puan/sıra/ortalama alanları isteğe bağlıdır — boş string girilmemiş demektir.
const emptyDetail = {
  score: '',
  branchRank: '',
  schoolRank: '',
  overallRank: '',
  classAvgScore: '',
  schoolAvgScore: '',
  turkeyAvgScore: '',
}

function detailFromSubject(s) {
  const asText = (n) => (n == null ? '' : String(n))
  return {
    score: asText(s.score),
    branchRank: asText(s.branchRank),
    schoolRank: asText(s.schoolRank),
    overallRank: asText(s.overallRank),
    classAvgScore: asText(s.classAvgScore),
    schoolAvgScore: asText(s.schoolAvgScore),
    turkeyAvgScore: asText(s.turkeyAvgScore),
  }
}

function buildInitialSubjects(kind, existing) {
  if (existing) {
    return existing.subjects.map((s) => {
      const hasQuestionRows = Array.isArray(s.questions) && s.questions.some((q) => q.status)
      return {
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        // Etüt'te sabit toplam yok — D/Y/B'den türer.
        total: existing.kind === 'etut' ? null : s.totalQuestions,
        counts: { correct: s.correct, wrong: s.wrong, blank: s.blank },
        photos: [],
        questionsMode: hasQuestionRows,
        questions: hasQuestionRows
          ? [...s.questions]
              .sort((a, b) => a.orderNo - b.orderNo)
              .map((q) => ({ orderNo: q.orderNo, status: q.status, topicName: q.topicName || '' }))
          : [],
        detail: detailFromSubject(s),
      }
    })
  }
  if (kind === 'genel') {
    return GENEL_DENEME_TEMPLATE.map((tpl) => ({
      subjectId: undefined,
      subjectName: tpl.name,
      total: tpl.total,
      counts: { ...emptyCounts, blank: tpl.total },
      photos: [],
      questionsMode: false,
      questions: [],
      detail: { ...emptyDetail },
    }))
  }
  // Etüt: sabit toplam yok (total null) — D/Y/B'yi kullanıcı girer.
  return [
    {
      subjectId: undefined,
      subjectName: '',
      total: kind === 'brans' ? BRANS_QUESTION_COUNT : null,
      counts: kind === 'brans' ? { ...emptyCounts, blank: BRANS_QUESTION_COUNT } : { ...emptyCounts },
      photos: [],
      questionsMode: false,
      questions: [],
      detail: { ...emptyDetail },
    },
  ]
}

function ExamDrawer({ existing, initialKind, studentId, fetchTopicSuggestions, onClose, onSubmit, submitting }) {
  const [step, setStep] = useState(existing || initialKind ? 'form' : 'kind')
  const [kind, setKind] = useState(existing?.kind || initialKind || 'brans')
  const [examDate, setExamDate] = useState(existing?.examDate || todayISODate())
  const [title, setTitle] = useState(existing?.title || '')
  const [subjectRows, setSubjectRows] = useState(() =>
    buildInitialSubjects(existing?.kind || initialKind || 'brans', existing),
  )
  const [subjects, setSubjects] = useState([])
  const [error, setError] = useState('')
  const [captureFor, setCaptureFor] = useState(null) // index of subjectRows
  const [topicSuggestions, setTopicSuggestions] = useState({}) // subjectName -> string[]
  const [classLabel, setClassLabel] = useState(existing?.classLabel || '')
  const [schoolLabel, setSchoolLabel] = useState(existing?.schoolLabel || '')
  // Puan/sıra/ortalama: sınav kurumu raporundan (PDF/portal) elle girilen isteğe bağlı detay —
  // düzenlemede bu alanlardan biri doluysa varsayılan olarak açık gelir.
  const [showDetail, setShowDetail] = useState(
    () =>
      Boolean(existing?.classLabel) ||
      Boolean(existing?.schoolLabel) ||
      Boolean(existing?.subjects?.some((s) => s.score != null)),
  )

  useEffect(() => {
    cachedGet('/api/panel/subjects')
      .then((data) => setSubjects(data.subjects || []))
      .catch(() => setSubjects([]))
  }, [])

  const kindMeta = MOCK_EXAM_KINDS.find((k) => k.value === kind)
  const selectableSubjects = useMemo(() => gradeEightSubjects(subjects), [subjects])

  const chooseKind = (nextKind) => {
    setKind(nextKind)
    setSubjectRows(buildInitialSubjects(nextKind, null))
    setError('')
    setStep('form')
  }

  const patchRow = (index, patch) => {
    setSubjectRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const patchDetail = (index, key, value) => {
    setSubjectRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, detail: { ...row.detail, [key]: value } } : row)),
    )
  }

  const chooseSubject = (index, subjectId) => {
    const hit = subjects.find((s) => s.id === subjectId)
    patchRow(index, { subjectId, subjectName: hit?.name || '' })
  }

  const loadTopicSuggestions = useCallback(
    (subjectName) => {
      if (!fetchTopicSuggestions || !subjectName || topicSuggestions[subjectName]) return
      setTopicSuggestions((prev) => ({ ...prev, [subjectName]: [] }))
      fetchTopicSuggestions(subjectName, studentId)
        .then((topics) => setTopicSuggestions((prev) => ({ ...prev, [subjectName]: topics || [] })))
        .catch(() => {})
    },
    [fetchTopicSuggestions, studentId, topicSuggestions],
  )

  const setQuestionsMode = (index, enabled) => {
    setSubjectRows((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row
        if (!enabled) return { ...row, questionsMode: false }
        const total = row.total ?? row.counts.correct + row.counts.wrong + row.counts.blank
        const size = Math.max(1, total || 1)
        const questions =
          row.questions.length === size
            ? row.questions
            : Array.from({ length: size }, (_, qi) => row.questions[qi] || defaultQuestionRow(qi + 1))
        return { ...row, questionsMode: true, questions }
      }),
    )
    const subjectName = subjectRows[index]?.subjectName
    if (enabled && subjectName) loadTopicSuggestions(subjectName)
  }

  const patchQuestion = (index, qIndex, patch) => {
    setSubjectRows((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row
        return { ...row, questions: row.questions.map((q, qi) => (qi === qIndex ? { ...q, ...patch } : q)) }
      }),
    )
  }

  const addQuestionRow = (index) => {
    setSubjectRows((rows) =>
      rows.map((row, i) => {
        if (i !== index || row.questions.length >= MAX_ETUT_QUESTIONS) return row
        return { ...row, questions: [...row.questions, defaultQuestionRow(row.questions.length + 1)] }
      }),
    )
  }

  const removeQuestionRow = (index) => {
    setSubjectRows((rows) =>
      rows.map((row, i) => (i !== index || row.questions.length <= 1 ? row : { ...row, questions: row.questions.slice(0, -1) })),
    )
  }

  const setCount = (index, key, next) => {
    setSubjectRows((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row
        const fixed = row.total != null
        const counts = { ...row.counts, [key]: fixed ? Math.min(row.total, next) : next }
        // Sabit toplamlı türlerde (Branş/Genel) doğru/yanlış girildikçe boş otomatik hesaplanır.
        if (fixed && key !== 'blank') counts.blank = Math.max(0, row.total - counts.correct - counts.wrong)
        return { ...row, counts }
      }),
    )
  }

  const handleSubmit = () => {
    setError('')
    if (kindMeta?.dateRequired && !examDate) {
      setError('Sınav tarihi zorunludur.')
      return
    }
    for (const row of subjectRows) {
      if (!row.subjectName) {
        setError('Ders seçilmelidir.')
        return
      }
      if (row.questionsMode) {
        if (!row.questions.length) {
          setError(`${row.subjectName}: en az 1 soru olmalı.`)
          return
        }
        continue
      }
      const sum = row.counts.correct + row.counts.wrong + row.counts.blank
      if (row.total != null && sum !== row.total) {
        setError(`${row.subjectName || 'Ders'}: doğru + yanlış + boş toplamı ${row.total} olmalı.`)
        return
      }
      if (row.total == null && (sum < 1 || sum > MAX_ETUT_QUESTIONS)) {
        setError(`${row.subjectName || 'Ders'}: doğru + yanlış + boş toplamı 1 ile ${MAX_ETUT_QUESTIONS} arasında olmalı.`)
        return
      }
      if (row.photos.length > row.counts.wrong + row.counts.blank) {
        setError(`${row.subjectName}: fotoğraf sayısı yanlış + boş sayısını aşamaz.`)
        return
      }
    }

    const detailFields = (row) =>
      showDetail
        ? {
            score: toNumOrUndef(row.detail.score),
            branchRank: toNumOrUndef(row.detail.branchRank),
            schoolRank: toNumOrUndef(row.detail.schoolRank),
            overallRank: toNumOrUndef(row.detail.overallRank),
            classAvgScore: toNumOrUndef(row.detail.classAvgScore),
            schoolAvgScore: toNumOrUndef(row.detail.schoolAvgScore),
            turkeyAvgScore: toNumOrUndef(row.detail.turkeyAvgScore),
          }
        : {}

    const payload = {
      kind,
      examDate: kind === 'etut' && !examDate ? null : examDate,
      title: title.trim() || undefined,
      classLabel: showDetail ? classLabel.trim() || undefined : undefined,
      schoolLabel: showDetail ? schoolLabel.trim() || undefined : undefined,
      subjects: subjectRows.map((row) => {
        const subjectId = row.subjectId || matchSubjectId(subjects, row.subjectName)
        if (row.questionsMode) {
          return {
            subjectId,
            subjectName: row.subjectName,
            totalQuestions: row.questions.length,
            questions: row.questions.map((q) => ({
              orderNo: q.orderNo,
              status: q.status,
              topicName: q.topicName?.trim() || undefined,
            })),
            ...detailFields(row),
          }
        }
        return {
          subjectId,
          subjectName: row.subjectName,
          totalQuestions: row.total ?? row.counts.correct + row.counts.wrong + row.counts.blank,
          correct: row.counts.correct,
          wrong: row.counts.wrong,
          blank: row.counts.blank,
          photos: row.photos,
          ...detailFields(row),
        }
      }),
    }
    onSubmit(payload)
  }

  const totalPhotos = subjectRows.reduce((sum, row) => sum + (row.questionsMode ? 0 : row.photos.length), 0)
  const encouragedPhotos = subjectRows.reduce(
    (sum, row) => sum + (row.questionsMode ? 0 : row.counts.wrong + row.counts.blank),
    0,
  )
  const anyQuestionsMode = subjectRows.some((row) => row.questionsMode)
  const KindIcon = KIND_ICONS[kind] || FileCheck2

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'flex max-h-[92vh] w-full min-w-0 flex-col overflow-hidden rounded-t-3xl bg-panel-surface shadow-2xl sm:max-h-[90vh] sm:rounded-2xl',
          kind === 'genel' ? 'sm:max-w-2xl' : 'sm:max-w-xl',
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-panel-border px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-panel-text">
              {existing ? 'Denemeyi Düzenle' : 'Yeni Deneme Ekle'}
            </h2>
            <p className="mt-1 text-sm font-medium text-panel-text-muted">
              {step === 'kind' ? 'Deneme türünü seç' : mockExamKindLabel(kind)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            disabled={submitting}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-panel-text-muted transition-colors hover:bg-panel-surface-soft hover:text-panel-text disabled:opacity-60"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-[22rem] flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {step === 'kind' ? (
            <div className="flex flex-col gap-2.5">
              {MOCK_EXAM_KINDS.map((option) => {
                const Icon = KIND_ICONS[option.value] || FileCheck2
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => chooseKind(option.value)}
                    className="flex items-start gap-3 rounded-xl border border-panel-border bg-white p-3.5 text-left shadow-sm transition-colors hover:border-panel-warm hover:bg-panel-warm-soft/35"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-panel-text">{option.label}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-panel-text-muted">{option.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2 rounded-xl bg-panel-surface-soft/70 px-3 py-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-panel-text">
                  <KindIcon size={16} className="text-panel-blue" aria-hidden="true" />
                  {mockExamKindLabel(kind)}
                </span>
                {!existing ? (
                  <button
                    type="button"
                    onClick={() => setStep('kind')}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-panel-blue hover:bg-panel-blue-soft"
                  >
                    Türü değiştir
                  </button>
                ) : null}
              </div>

              <div className="flex flex-col gap-2.5">
                <DateField
                  value={examDate}
                  onChange={setExamDate}
                  placeholder={`Sınav tarihi${kindMeta?.dateRequired ? '' : ' (isteğe bağlı)'}`}
                />
                <input
                  type="text"
                  value={title}
                  maxLength={200}
                  placeholder="Başlık (isteğe bağlı)"
                  onChange={(event) => setTitle(event.target.value)}
                  className={cn(FIELD_CLASS, 'p-2.5 text-sm')}
                />
                {kind !== 'genel' ? (
                  <select
                    aria-label="Ders"
                    value={subjectRows[0]?.subjectId || ''}
                    onChange={(event) => chooseSubject(0, event.target.value)}
                    className={cn(FIELD_CLASS, 'p-2.5 text-sm', !subjectRows[0]?.subjectId && 'text-panel-text-muted')}
                  >
                    <option value="">Ders seçin</option>
                    {selectableSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowDetail((v) => !v)}
                  className="self-start rounded-lg px-2 py-1 text-xs font-semibold text-panel-blue hover:bg-panel-blue-soft"
                >
                  {showDetail ? 'Puan / sıra detayını gizle' : '+ Puan / sıra detayı ekle (isteğe bağlı)'}
                </button>
                {showDetail ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      value={classLabel}
                      maxLength={50}
                      placeholder="Sınıf (ör. 8D, isteğe bağlı)"
                      onChange={(event) => setClassLabel(event.target.value)}
                      className={cn(FIELD_CLASS, 'p-2.5 text-sm')}
                    />
                    <input
                      type="text"
                      value={schoolLabel}
                      maxLength={200}
                      placeholder="Okul adı (isteğe bağlı)"
                      onChange={(event) => setSchoolLabel(event.target.value)}
                      className={cn(FIELD_CLASS, 'p-2.5 text-sm')}
                    />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-2.5">
                {kind === 'genel' ? (
                  <p className="text-xs font-medium text-panel-text-muted">Her ders için doğru / yanlış / boş sayısı</p>
                ) : kind === 'etut' ? (
                  <p className="text-xs font-medium text-panel-text-muted">
                    Doğru / yanlış / boş — toplam soru sayısı bunların toplamıdır
                  </p>
                ) : null}
                {subjectRows.map((row, index) => {
                  const questionCounts = row.questionsMode
                    ? {
                        correct: row.questions.filter((q) => q.status === 'dogru').length,
                        wrong: row.questions.filter((q) => q.status === 'yanlis').length,
                        blank: row.questions.filter((q) => q.status === 'bos').length,
                      }
                    : row.counts
                  return (
                    <div key={index} className="flex flex-col gap-2 rounded-xl border border-panel-border bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        {kind === 'genel' ? <span className="flex-1" /> : null}
                        <button
                          type="button"
                          onClick={() => setQuestionsMode(index, !row.questionsMode)}
                          className={cn(
                            'shrink-0 rounded-lg px-2 py-1 text-xs font-semibold transition-colors',
                            row.questionsMode
                              ? 'bg-panel-blue-soft text-panel-blue'
                              : 'text-panel-blue hover:bg-panel-blue-soft',
                          )}
                        >
                          {row.questionsMode ? 'Basit moda dön' : 'Soru bazlı gir'}
                        </button>
                      </div>

                      <CountsRow
                        total={row.total}
                        counts={questionCounts}
                        name={kind === 'genel' ? row.subjectName : null}
                        readOnly={row.questionsMode}
                        onCount={(key, next) => setCount(index, key, next)}
                      />

                      {showDetail ? (
                        <div className="grid grid-cols-2 gap-2 rounded-lg bg-panel-surface-soft/60 p-2 sm:grid-cols-4">
                          <DetailField
                            label="Puan"
                            value={row.detail.score}
                            onChange={(v) => patchDetail(index, 'score', v)}
                          />
                          <DetailField
                            label="Şube Sıra"
                            value={row.detail.branchRank}
                            onChange={(v) => patchDetail(index, 'branchRank', v)}
                          />
                          <DetailField
                            label="Okul Sıra"
                            value={row.detail.schoolRank}
                            onChange={(v) => patchDetail(index, 'schoolRank', v)}
                          />
                          <DetailField
                            label="Genel Sıra"
                            value={row.detail.overallRank}
                            onChange={(v) => patchDetail(index, 'overallRank', v)}
                          />
                          <DetailField
                            label="Sınıf Ort."
                            value={row.detail.classAvgScore}
                            onChange={(v) => patchDetail(index, 'classAvgScore', v)}
                          />
                          <DetailField
                            label="Okul Ort."
                            value={row.detail.schoolAvgScore}
                            onChange={(v) => patchDetail(index, 'schoolAvgScore', v)}
                          />
                          <DetailField
                            label="Türkiye Ort."
                            value={row.detail.turkeyAvgScore}
                            onChange={(v) => patchDetail(index, 'turkeyAvgScore', v)}
                          />
                        </div>
                      ) : null}

                      {row.questionsMode ? (
                        <QuestionRows
                          idPrefix={`mock-exam-topics-${index}`}
                          questions={row.questions}
                          editableTotal={row.total == null}
                          suggestions={topicSuggestions[row.subjectName] || []}
                          onPatch={(qi, patch) => patchQuestion(index, qi, patch)}
                          onAdd={() => addQuestionRow(index)}
                          onRemove={() => removeQuestionRow(index)}
                        />
                      ) : !existing ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {row.photos.map((photo, photoIndex) => (
                            <div
                              key={photoIndex}
                              className="relative h-14 w-14 overflow-hidden rounded-lg border border-panel-border"
                            >
                              <img src={photo} alt="" className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => patchRow(index, { photos: row.photos.filter((_, i) => i !== photoIndex) })}
                                className="absolute right-0 top-0 rounded-bl-lg bg-black/60 p-0.5 text-white transition-colors hover:bg-black/80"
                                aria-label="Görseli kaldır"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                          {row.photos.length < row.counts.wrong + row.counts.blank ? (
                            <button
                              type="button"
                              onClick={() => setCaptureFor(index)}
                              className="flex h-14 items-center gap-1.5 rounded-lg border border-dashed border-panel-blue/50 bg-panel-blue-soft/40 px-3 text-xs font-semibold text-panel-blue transition-colors hover:bg-panel-blue-soft"
                            >
                              <ImagePlus size={16} aria-hidden="true" />
                              Hata görseli ekle
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              {existing || anyQuestionsMode ? (
                <p className="rounded-xl bg-panel-surface-soft px-4 py-3 text-xs text-panel-text-muted">
                  Hata görselleri denemeyi kaydettikten sonra karttan eklenip çıkarılabilir.
                </p>
              ) : encouragedPhotos > 0 && totalPhotos < encouragedPhotos ? (
                <p className="rounded-xl bg-panel-yellow-soft px-4 py-3 text-sm text-panel-yellow">
                  {encouragedPhotos} yanlış/boş sorudan {totalPhotos} tanesinin görseli eklendi. Görseller Hata
                  Defteri&apos;nde &quot;Deneme Sınavları&quot; altında toplanır — eklemen önerilir.
                </p>
              ) : null}

              {error ? (
                <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-sm font-medium text-panel-warm">{error}</div>
              ) : null}
            </div>
          )}
        </div>

        {step === 'form' ? (
          <div className="flex flex-col gap-2 border-t border-panel-border px-4 py-3 sm:flex-row sm:justify-end sm:gap-3 sm:px-6 sm:py-4">
            <Button variant="secondary" size="md" onClick={onClose} disabled={submitting} className="h-11 sm:h-10">
              Vazgeç
            </Button>
            <Button size="md" onClick={handleSubmit} disabled={submitting} className="h-11 sm:h-10">
              {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
              {existing ? 'Değişiklikleri Kaydet' : 'Denemeyi Ekle'}
            </Button>
          </div>
        ) : null}
      </div>

      {captureFor !== null ? (
        <MistakePhotoCaptureModal
          onClose={() => setCaptureFor(null)}
          onSave={async (dataUrl) => {
            patchRow(captureFor, { photos: [...subjectRows[captureFor].photos, dataUrl] })
          }}
        />
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ görsel görüntüleme */

function PhotoModal({ questions, fetchPhoto, onClose, onDelete }) {
  const [index, setIndex] = useState(0)
  const [urls, setUrls] = useState({})
  const item = questions[index]

  useEffect(() => {
    if (!item || urls[item.id] || !item.hasPhoto) return
    let ignore = false
    fetchPhoto(item.id)
      .then((url) => {
        if (!ignore) setUrls((prev) => ({ ...prev, [item.id]: url }))
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [item, fetchPhoto, urls])

  if (!item) return null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-semibold tabular-nums">
          {index + 1} / {questions.length}
        </span>
        <div className="flex items-center gap-2">
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-semibold transition-colors hover:bg-white/25"
            >
              <Trash2 size={14} aria-hidden="true" /> Sil
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
            aria-label="Kapat"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
        {urls[item.id] ? (
          <img src={urls[item.id]} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
        ) : (
          <Loader2 size={28} className="animate-spin text-white/70" />
        )}
      </div>
      {questions.length > 1 ? (
        <div className="flex items-center justify-center gap-3 pb-5 text-white">
          <button
            type="button"
            onClick={() => setIndex((index - 1 + questions.length) % questions.length)}
            className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/25"
          >
            Önceki
          </button>
          <button
            type="button"
            onClick={() => setIndex((index + 1) % questions.length)}
            className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/25"
          >
            Sonraki
          </button>
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ deneme kartı */

function SubjectLine({ subject, readOnly, onViewPhotos, onAddPhoto, onManageQuestions }) {
  const isQuestionMode = Array.isArray(subject.questions) && subject.questions.some((q) => q.status)
  const rankParts = []
  if (subject.branchRank != null) rankParts.push(`Şube ${subject.branchRank}`)
  if (subject.schoolRank != null) rankParts.push(`Okul ${subject.schoolRank}`)
  if (subject.overallRank != null) rankParts.push(`Genel ${subject.overallRank}`)
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-panel-border/60 py-2.5 first:border-t-0">
      <span className="min-w-28 flex-1 text-sm font-semibold text-panel-text">{subject.subjectName}</span>
      <StatPill label="D" value={subject.correct} tone="bg-panel-green-soft text-panel-green" />
      <StatPill label="Y" value={subject.wrong} tone="bg-panel-red-soft text-panel-red" />
      <StatPill label="B" value={subject.blank} tone="bg-panel-surface-soft text-panel-text-muted" />
      <StatPill label="Net" value={subject.net} tone="bg-panel-blue-soft text-panel-blue" />
      <span className={cn('rounded-lg px-2 py-0.5 text-xs font-semibold tabular-nums', successTone(subject.successRate))}>
        %{subject.successRate}
      </span>
      {subject.score != null ? (
        <StatPill label="Puan" value={subject.score} tone="bg-panel-lilac-soft text-panel-lilac" />
      ) : null}
      {rankParts.length > 0 ? (
        <span className="w-full text-[11px] font-medium text-panel-text-muted sm:w-auto">{rankParts.join(' · ')}</span>
      ) : null}
      {subject.photoCount > 0 ? (
        <button
          type="button"
          onClick={onViewPhotos}
          className="inline-flex items-center gap-1 rounded-lg bg-panel-blue-soft px-2 py-1 text-xs font-semibold text-panel-blue hover:brightness-95"
        >
          <ImagePlus size={13} aria-hidden="true" />
          {subject.photoCount} görsel
        </button>
      ) : null}
      {!readOnly && isQuestionMode && onManageQuestions ? (
        <button
          type="button"
          onClick={onManageQuestions}
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-panel-blue/50 px-2 py-1 text-xs font-semibold text-panel-blue hover:bg-panel-blue-soft"
        >
          <ImagePlus size={13} aria-hidden="true" /> Soruları yönet
        </button>
      ) : !readOnly && onAddPhoto ? (
        <button
          type="button"
          onClick={onAddPhoto}
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-panel-blue/50 px-2 py-1 text-xs font-semibold text-panel-blue hover:bg-panel-blue-soft"
        >
          <Plus size={13} aria-hidden="true" /> Görsel ekle
        </button>
      ) : null}
    </div>
  )
}

// Soru bazlı bir dersin yanlış/boş sorularını listeler; her birine ayrı ayrı fotoğraf
// eklenebilir/görüntülenebilir (eski moddaki tek "Görsel ekle" sıralı akışının yerine).
function QuestionPhotoManagerModal({ subject, fetchPhoto, onAddPhoto, onDeletePhoto, onClose }) {
  const [captureFor, setCaptureFor] = useState(null) // questionRowId
  const [viewingId, setViewingId] = useState(null) // questionRowId
  const wrongOrBlank = (subject.questions || []).filter((q) => q.status === 'yanlis' || q.status === 'bos')
  const viewingQuestion = viewingId ? wrongOrBlank.find((q) => q.questionRowId === viewingId) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-panel-surface shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-panel-border px-4 py-3">
          <h3 className="min-w-0 truncate text-sm font-semibold text-panel-text">
            {subject.subjectName} — yanlış/boş sorular
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="shrink-0 rounded-full p-1.5 text-panel-text-muted hover:bg-panel-surface-soft"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-panel-border/60 px-4">
          {wrongOrBlank.length === 0 ? (
            <p className="py-6 text-center text-sm text-panel-text-muted">Bu derste yanlış/boş soru yok.</p>
          ) : (
            wrongOrBlank.map((q) => (
              <div key={q.questionRowId} className="flex items-center gap-2 py-2.5">
                <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-panel-text-muted">
                  {q.orderNo}
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold',
                    q.status === 'yanlis' ? 'bg-panel-red-soft text-panel-red' : 'bg-panel-surface-soft text-panel-text-muted',
                  )}
                >
                  {q.status === 'yanlis' ? 'Y' : 'B'}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-panel-text-muted">{q.topicName || 'Konu yok'}</span>
                {q.hasPhoto ? (
                  <button
                    type="button"
                    onClick={() => setViewingId(q.questionRowId)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-panel-blue-soft px-2 py-1 text-xs font-semibold text-panel-blue hover:brightness-95"
                  >
                    Görüntüle
                  </button>
                ) : onAddPhoto ? (
                  <button
                    type="button"
                    onClick={() => setCaptureFor(q.questionRowId)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-panel-blue/50 px-2 py-1 text-xs font-semibold text-panel-blue hover:bg-panel-blue-soft"
                  >
                    <ImagePlus size={13} aria-hidden="true" /> Ekle
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {captureFor ? (
        <MistakePhotoCaptureModal
          onClose={() => setCaptureFor(null)}
          onSave={async (dataUrl) => {
            await onAddPhoto(captureFor, dataUrl)
          }}
        />
      ) : null}

      {viewingQuestion ? (
        <PhotoModal
          questions={[viewingQuestion]}
          fetchPhoto={fetchPhoto}
          onClose={() => setViewingId(null)}
          onDelete={
            onDeletePhoto
              ? async (wrongQuestionId) => {
                  await onDeletePhoto(wrongQuestionId)
                  setViewingId(null)
                }
              : undefined
          }
        />
      ) : null}
    </div>
  )
}

// Sabit sırada, CVD-güvenli 4 renk (bkz. dataviz kılavuzu referans paleti, slot 1-4):
// öğrenci / sınıf / okul / Türkiye ortalaması hep aynı renkte kalır.
const COMPARISON_COLORS = { student: '#2a78d6', classAvg: '#eb6834', schoolAvg: '#1baf7a', turkeyAvg: '#eda100' }

function shortenSubjectName(name) {
  return name.length > 14 ? `${name.slice(0, 13)}…` : name
}

function ComparisonChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const fullName = payload[0]?.payload?.fullName
  return (
    <div className="rounded-xl border border-panel-border bg-panel-surface px-3 py-2 text-xs shadow-lg">
      {fullName ? <p className="mb-1 font-bold text-panel-text">{fullName}</p> : null}
      {payload
        .filter((entry) => entry.value != null)
        .map((entry) => (
          <p key={entry.dataKey} className="flex items-center gap-2 text-panel-text-muted">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="font-semibold text-panel-text">{entry.name}</span>
            <span className="ml-auto pl-3 font-bold tabular-nums text-panel-text">{entry.value}</span>
          </p>
        ))}
    </div>
  )
}

// Puan girilmiş dersleri; öğrenci/sınıf/okul/Türkiye ortalaması karşılaştırma grafiği.
// classLabel/schoolLabel girilmemişse jenerik "Sınıf/Okul Ortalaması" etiketi kullanılır.
function ExamComparisonChart({ exam }) {
  const rows = (exam.subjects || [])
    .filter((s) => s.score != null)
    .map((s) => ({
      name: shortenSubjectName(s.subjectName),
      fullName: s.subjectName,
      student: s.score,
      classAvg: s.classAvgScore ?? undefined,
      schoolAvg: s.schoolAvgScore ?? undefined,
      turkeyAvg: s.turkeyAvgScore ?? undefined,
    }))
  if (rows.length === 0) return null

  const axisTick = { fontSize: 10, fill: 'var(--color-panel-text-muted)' }

  return (
    <div className="mt-3 rounded-xl border border-panel-border bg-white p-3">
      <p className="mb-2 text-xs font-semibold text-panel-text-muted">Puan karşılaştırması</p>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -16 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="var(--color-panel-border)" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
            <YAxis domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} width={30} />
            <Tooltip cursor={{ fill: 'var(--color-panel-surface-soft)' }} content={<ComparisonChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="student" name="Öğrenci" fill={COMPARISON_COLORS.student} radius={[4, 4, 0, 0]} />
            <Bar
              dataKey="classAvg"
              name={exam.classLabel || 'Sınıf Ortalaması'}
              fill={COMPARISON_COLORS.classAvg}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="schoolAvg"
              name={exam.schoolLabel || 'Okul Ortalaması'}
              fill={COMPARISON_COLORS.schoolAvg}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="turkeyAvg"
              name="Türkiye Ortalaması"
              fill={COMPARISON_COLORS.turkeyAvg}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ExamCard({
  exam: summary,
  readOnly,
  studentId,
  bare = false,
  fetchMockExam,
  fetchPhoto,
  addPhoto,
  addQuestionPhoto,
  deletePhoto,
  onEdit,
  onDelete,
  onChanged,
}) {
  const [open, setOpen] = useState(false)
  const [photoSubject, setPhotoSubject] = useState(null)
  const [addFor, setAddFor] = useState(null)
  const [manageSubjectId, setManageSubjectId] = useState(null)
  const [detail, setDetail] = useState(summary.subjects?.[0]?.questions ? summary : null)
  const exam = detail || summary
  const manageSubject = manageSubjectId ? exam.subjects.find((s) => s.id === manageSubjectId) : null

  const loadDetail = useCallback(() => {
    if (!fetchMockExam) return
    fetchMockExam(summary.id, studentId)
      .then(setDetail)
      .catch(() => {})
  }, [fetchMockExam, summary.id, studentId])

  useEffect(() => {
    if (!open || detail || !fetchMockExam) return
    let ignore = false
    fetchMockExam(summary.id, studentId)
      .then((full) => {
        if (!ignore) setDetail(full)
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [open, detail, fetchMockExam, summary.id, studentId])

  const KindIcon = KIND_ICONS[exam.kind] || FileCheck2

  return (
    <div className={cn('overflow-hidden', bare ? '' : 'panel-card')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-panel-surface-soft/50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-panel-blue-soft text-panel-blue">
          <KindIcon size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-sm font-semibold text-panel-text">
              {exam.title || mockExamKindLabel(exam.kind)}
            </span>
            <span className="shrink-0 text-xs font-normal text-panel-text-muted">
              {exam.kind === 'genel' ? `${exam.subjects.length} ders` : `${exam.totalQuestions} soru`}
            </span>
          </div>
          <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-panel-text-muted">
            <CalendarDays size={12} aria-hidden="true" /> {formatExamDate(exam.examDate)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatPill label="Net" value={exam.net} tone="bg-panel-blue-soft text-panel-blue" />
          <span className={cn('rounded-lg px-2 py-0.5 text-xs font-semibold tabular-nums', successTone(exam.successRate))}>
            %{exam.successRate}
          </span>
          {open ? (
            <ChevronDown size={16} className="shrink-0 text-panel-text-muted" aria-hidden="true" />
          ) : (
            <ChevronRight size={16} className="shrink-0 text-panel-text-muted" aria-hidden="true" />
          )}
        </div>
      </button>

      {open ? (
        <div className="border-t border-panel-border px-4 py-3">
          <div className="flex flex-col">
            {exam.subjects.map((subject) => (
              <SubjectLine
                key={subject.id}
                subject={subject}
                readOnly={readOnly}
                onViewPhotos={() => setPhotoSubject(subject)}
                onAddPhoto={addPhoto ? () => setAddFor(subject) : undefined}
                onManageQuestions={addQuestionPhoto ? () => setManageSubjectId(subject.id) : undefined}
              />
            ))}
          </div>
          <ExamComparisonChart exam={exam} />
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-panel-border/60 pt-3 text-xs text-panel-text-muted">
            <span>
              Toplam {exam.totalCorrect}D · {exam.totalWrong}Y · {exam.totalBlank}B
            </span>
            {exam.createdByName ? <span>· ekleyen: {exam.createdByName}</span> : null}
            <span className="flex-1" />
            {!readOnly && onEdit ? (
              <button
                type="button"
                onClick={() => onEdit(exam)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-panel-blue hover:bg-panel-blue-soft"
              >
                <Pencil size={13} aria-hidden="true" /> Düzenle
              </button>
            ) : null}
            {!readOnly && onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(exam)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-panel-red hover:bg-panel-red-soft"
              >
                <Trash2 size={13} aria-hidden="true" /> Sil
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {photoSubject ? (
        <PhotoModal
          questions={(photoSubject.questions || []).filter((q) => q.hasPhoto)}
          fetchPhoto={(id) => fetchPhoto(id, studentId)}
          onClose={() => setPhotoSubject(null)}
          onDelete={
            !readOnly && deletePhoto
              ? async (wrongQuestionId) => {
                  await deletePhoto(wrongQuestionId, studentId)
                  setPhotoSubject(null)
                  loadDetail()
                  onChanged?.()
                }
              : undefined
          }
        />
      ) : null}

      {addFor ? (
        <MistakePhotoCaptureModal
          onClose={() => setAddFor(null)}
          onSave={async (dataUrl) => {
            await addPhoto(summary.id, addFor.id, dataUrl, studentId)
            loadDetail()
            onChanged?.()
          }}
        />
      ) : null}

      {manageSubject ? (
        <QuestionPhotoManagerModal
          subject={manageSubject}
          fetchPhoto={(id) => fetchPhoto(id, studentId)}
          onAddPhoto={async (questionRowId, dataUrl) => {
            await addQuestionPhoto(summary.id, manageSubject.id, questionRowId, dataUrl, studentId)
            loadDetail()
            onChanged?.()
          }}
          onDeletePhoto={
            deletePhoto
              ? async (wrongQuestionId) => {
                  await deletePhoto(wrongQuestionId, studentId)
                  loadDetail()
                  onChanged?.()
                }
              : undefined
          }
          onClose={() => setManageSubjectId(null)}
        />
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ ana görünüm */

export default function MockExamsView({
  readOnly = false,
  studentId,
  embedded = false,
  fetchMockExams,
  fetchMockExam,
  fetchPhoto,
  createMockExam,
  updateMockExam,
  deleteMockExam,
  addPhoto,
  addQuestionPhoto,
  deletePhoto,
  fetchTopicSuggestions,
  fetchTopicStats,
}) {
  const [exams, setExams] = useState(null)
  const [error, setError] = useState('')
  const [drawer, setDrawer] = useState(null) // { existing? | initialKind? }
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [activeKind, setActiveKind] = useState(MOCK_EXAM_KINDS[0].value)
  const [view, setView] = useState('list') // 'list' | 'topics'

  // Sekme başına: o türdeki denemeler + adet + (Genel Deneme'de) ortalama başarı %.
  const kindGroups = useMemo(() => {
    const list = exams || []
    return MOCK_EXAM_KINDS.map((meta) => {
      const kindExams = list.filter((exam) => exam.kind === meta.value)
      const avgSuccess = kindExams.length
        ? Math.round(kindExams.reduce((sum, exam) => sum + exam.successRate, 0) / kindExams.length)
        : null
      return { ...meta, exams: kindExams, count: kindExams.length, avgSuccess }
    })
  }, [exams])

  const activeGroup = kindGroups.find((group) => group.value === activeKind) || kindGroups[0]

  // Branş İzleme / Etüt (tek derslik) sekmelerinde denemeler derse göre gruplanır.
  const subjectGroups = useMemo(() => {
    if (!activeGroup || activeGroup.value === 'genel') return null
    const map = new Map()
    activeGroup.exams.forEach((exam) => {
      const name = exam.subjects[0]?.subjectName || 'Ders belirtilmemiş'
      let entry = map.get(name)
      if (!entry) {
        entry = { subject: name, exams: [], totalQuestions: 0, correct: 0, wrong: 0, blank: 0 }
        map.set(name, entry)
      }
      entry.exams.push(exam)
      entry.totalQuestions += exam.totalQuestions
      entry.correct += exam.totalCorrect
      entry.wrong += exam.totalWrong
      entry.blank += exam.totalBlank
    })
    return [...map.values()]
      .map((entry) => ({
        ...entry,
        net: computeNet(entry.correct, entry.wrong),
        successRate: entry.totalQuestions > 0 ? Math.round((entry.correct / entry.totalQuestions) * 1000) / 10 : 0,
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject, 'tr'))
  }, [activeGroup])

  const load = useCallback(() => {
    setError('')
    fetchMockExams(studentId)
      .then(setExams)
      .catch((err) => setError(err.message))
  }, [fetchMockExams, studentId])

  const loadTopicStats = useCallback(() => fetchTopicStats(studentId), [fetchTopicStats, studentId])

  useEffect(() => {
    load()
  }, [load])

  const handleSubmit = async (payload) => {
    setSubmitting(true)
    try {
      const body = studentId ? { ...payload, studentId } : payload
      if (drawer?.existing) {
        await updateMockExam(drawer.existing.id, body, studentId)
      } else {
        await createMockExam(body)
      }
      setDrawer(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    const target = confirmDelete
    setConfirmDelete(null)
    try {
      await deleteMockExam(target.id, studentId)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  // Kartlar liste özetini taşıyor; görselleri göstermek için detay (questions) gerekli.
  const openEdit = async (exam) => {
    try {
      const detail = fetchMockExam ? await fetchMockExam(exam.id, studentId) : exam
      setDrawer({ existing: detail })
    } catch (err) {
      setError(err.message)
    }
  }

  const openNew = () => setDrawer({ initialKind: activeKind })

  const addButton =
    !readOnly && exams ? (
      <Button onClick={openNew}>
        <Plus size={16} /> Yeni Deneme Ekle
      </Button>
    ) : null

  const tabs =
    exams === null ? null : (
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex w-max gap-2">
          {kindGroups.map((group) => {
            const selected = group.value === activeGroup.value
            return (
              <button
                key={group.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setActiveKind(group.value)}
                className={cn(
                  'shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors',
                  selected
                    ? 'border-panel-blue bg-panel-blue text-white shadow-sm'
                    : 'border-panel-border bg-panel-surface text-panel-text-muted hover:bg-panel-surface-soft',
                )}
              >
                {group.label}
                <span className={cn('ml-1.5 tabular-nums', selected ? 'text-white/80' : 'text-panel-text-muted/80')}>
                  ({group.count}
                  {group.value === 'genel' && group.avgSuccess !== null ? ` · %${group.avgSuccess}` : ''})
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )

  const body = (() => {
    if (error && exams === null) {
      return <div className="rounded-xl bg-panel-red-soft px-4 py-3 text-sm text-panel-red">{error}</div>
    }
    if (exams === null) return <LoadingState label="Deneme sınavları yükleniyor…" />
    if (!activeGroup.exams.length) {
      return (
        <EmptyState
          icon={FileCheck2}
          title={`${activeGroup.label} sonucu yok`}
          description={
            readOnly
              ? 'Bu öğrenci için bu türde kayıtlı deneme sonucu bulunmuyor.'
              : `${activeGroup.label} sonuçlarını buradan ekleyebilirsin.`
          }
          action={readOnly ? undefined : addButton}
        />
      )
    }
    const errorBanner = error ? (
      <div className="rounded-xl bg-panel-red-soft px-4 py-2 text-sm text-panel-red">{error}</div>
    ) : null

    const cardProps = (exam) => ({
      key: exam.id,
      exam,
      readOnly,
      studentId,
      fetchMockExam,
      fetchPhoto,
      addPhoto,
      addQuestionPhoto,
      deletePhoto,
      onEdit: openEdit,
      onDelete: setConfirmDelete,
      onChanged: load,
    })

    // Genel Deneme: düz liste. Branş İzleme / Etüt: derse göre gruplu kartlar.
    if (!subjectGroups) {
      return (
        <div className="flex flex-col gap-3">
          {errorBanner}
          {activeGroup.exams.map((exam) => (
            <ExamCard {...cardProps(exam)} />
          ))}
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-4">
        {errorBanner}
        {subjectGroups.map((group) => (
          <div key={group.subject} className="panel-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-panel-border bg-panel-surface-soft/40 px-4 py-3">
              <span className={cn('rounded-lg px-2.5 py-1 text-sm font-bold', subjectTone(group.subject))}>
                {group.subject}
              </span>
              <span className="text-xs font-medium text-panel-text-muted">
                {group.exams.length} etüt · {group.totalQuestions} soru
              </span>
              <span className="flex-1" />
              <StatPill label="D" value={group.correct} tone="bg-panel-green-soft text-panel-green" />
              <StatPill label="Y" value={group.wrong} tone="bg-panel-red-soft text-panel-red" />
              <StatPill label="B" value={group.blank} tone="bg-panel-surface-soft text-panel-text-muted" />
              <StatPill label="Net" value={group.net} tone="bg-panel-blue-soft text-panel-blue" />
              <span
                className={cn(
                  'rounded-lg px-2 py-0.5 text-xs font-semibold tabular-nums',
                  successTone(group.successRate),
                )}
              >
                %{group.successRate}
              </span>
            </div>
            <div className="divide-y divide-panel-border/60">
              {group.exams.map((exam) => (
                <ExamCard {...cardProps(exam)} bare />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  })()

  const viewToggle = fetchTopicStats ? (
    <div className="flex gap-1.5 rounded-xl bg-panel-surface-soft p-1">
      {[
        { value: 'list', label: 'Denemeler' },
        { value: 'topics', label: 'Konu Analizi' },
      ].map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={view === opt.value}
          onClick={() => setView(opt.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
            view === opt.value ? 'bg-panel-surface text-panel-text shadow-sm' : 'text-panel-text-muted hover:text-panel-text',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  ) : null

  return (
    <div className="flex flex-col gap-4">
      {embedded ? (
        addButton && activeGroup.exams.length && view === 'list' ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {viewToggle}
            {addButton}
          </div>
        ) : viewToggle ? (
          <div className="flex justify-start">{viewToggle}</div>
        ) : null
      ) : (
        <PageHeader
          title="Deneme Sınavları"
          subtitle="Branş İzleme, Genel Deneme ve Etüt sonuçları."
          actions={view === 'list' && activeGroup.exams.length ? addButton : null}
        />
      )}

      {!embedded && viewToggle ? viewToggle : null}

      {view === 'topics' ? (
        <MockExamTopicAnalysis fetchTopicStats={loadTopicStats} />
      ) : (
        <>
          {tabs}
          {body}
        </>
      )}

      {drawer ? (
        <ExamDrawer
          existing={drawer.existing}
          initialKind={drawer.initialKind}
          studentId={studentId}
          fetchTopicSuggestions={fetchTopicSuggestions}
          submitting={submitting}
          onClose={() => setDrawer(null)}
          onSubmit={handleSubmit}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmationDialog
          title="Deneme silinsin mi?"
          description="Bu denemenin sonuçları ve yüklenen hata görselleri kalıcı olarak silinecek."
          confirmLabel="Sil"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}
    </div>
  )
}
