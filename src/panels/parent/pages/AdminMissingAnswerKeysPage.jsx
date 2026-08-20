import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { authRequest } from '../../../services/authClient'
import PageHeader from '../../layout/PageHeader'
import LoadingState from '../../shared/LoadingState'
import EmptyState from '../../shared/EmptyState'
import DataTable from '../../ui/DataTable'

export default function AdminMissingAnswerKeysPage() {
  const [resourceBooks, setResourceBooks] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    authRequest('/api/panel-admin/resource-books/missing-answer-key', { method: 'GET' })
      .then((data) => setResourceBooks(data.resourceBooks))
      .catch((err) => setError(err.message))
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Cevap Anahtarı Eksik Kaynaklar"
        subtitle="Soru bankası tipinde olup en az bir testinin cevap anahtarı tam girilmemiş kaynaklar."
      />

      {error ? (
        <div className="rounded-xl bg-panel-accent-soft px-4 py-3 text-base text-panel-warm">{error}</div>
      ) : resourceBooks === null ? (
        <LoadingState label="Kaynaklar yükleniyor..." />
      ) : resourceBooks.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Eksik yok"
          description="Cevap anahtarı eksik testi olan soru bankası kaynağı bulunmuyor."
        />
      ) : (
        <div className="fade-slide-in">
          <div className="grid gap-3 sm:hidden">
            {resourceBooks.map((book) => (
              <Link
                key={book.id}
                to={`/parent/admin/publishers?resourceBookId=${book.id}`}
                className="rounded-xl border border-panel-border bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  {book.imageUrl ? (
                    <img loading="lazy" decoding="async" src={book.imageUrl} alt={`${book.name} görseli`} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-panel-slate-soft text-panel-slate">
                      <BookOpen size={20} aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-panel-text">{book.name}</h2>
                    <p className="mt-1 text-xs text-panel-text-muted">{book.subjectName || 'Ders belirtilmemiş'}</p>
                    <p className="text-xs text-panel-text-muted">{book.publisherName || 'Yayın evi belirtilmemiş'}</p>
                  </div>
                </div>
                <span className="mt-3 inline-flex w-fit items-center rounded-full bg-panel-accent-soft px-2.5 py-1 text-xs font-semibold text-panel-warm">
                  {book.incompleteTestCount}/{book.totalTestCount} test eksik
                </span>
              </Link>
            ))}
          </div>

          <DataTable className="hidden sm:block">
            <div className="hidden items-center gap-3 bg-[#f8f7fb] px-4 py-3 text-[13px] font-semibold text-[#1c2b5e] sm:grid sm:grid-cols-[minmax(0,1fr)_180px_180px_140px]">
              <span>Kitap Adı</span>
              <span>Ders</span>
              <span>Yayın Evi</span>
              <span>Eksik Test</span>
            </div>
            <div className="divide-y divide-[#edf0f1]">
              {resourceBooks.map((book) => (
                <Link
                  key={book.id}
                  to={`/parent/admin/publishers?resourceBookId=${book.id}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-[#f8f7fb] sm:grid sm:grid-cols-[minmax(0,1fr)_180px_180px_140px] sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {book.imageUrl ? (
                      <img loading="lazy" decoding="async" src={book.imageUrl} alt={`${book.name} görseli`} className="h-8 w-8 rounded-lg object-cover" />
                    ) : null}
                    <span className="truncate text-sm font-medium text-[#253d3e]">{book.name}</span>
                  </div>
                  <span className="text-sm text-[#667475]">{book.subjectName || '—'}</span>
                  <span className="text-sm text-[#667475]">{book.publisherName || '—'}</span>
                  <span className="inline-flex w-fit items-center rounded-full bg-panel-accent-soft px-2 py-0.5 text-[11px] font-medium text-panel-warm">
                    {book.incompleteTestCount}/{book.totalTestCount} test eksik
                  </span>
                </Link>
              ))}
            </div>
          </DataTable>
        </div>
      )}
    </div>
  )
}
