import { Plus, Trash2 } from 'lucide-react'

export default function TopicsEditor({
  topics,
  updateTopic,
  updateTest,
  addTopic,
  removeTopic,
  addTest,
  removeTest,
  showTocHint,
}) {
  return (
    <div className="flex flex-col gap-4">
      {showTocHint ? (
        <p className="rounded-lg bg-panel-blue-soft px-3 py-2 text-xs text-panel-blue">
          İçindekiler fotoğraflarından okunabilenler önceden dolduruldu. Lütfen kontrol edip soru sayılarını girin;
          gerekirse diğer alanları da düzenleyebilirsiniz.
        </p>
      ) : null}
      {topics.map((topic, topicIndex) => (
        <div key={topic.id} className="rounded-xl border border-panel-border p-3">
          <div className="mb-2 flex items-center gap-2">
            <input
              value={topic.name}
              onChange={(event) => updateTopic(topic.id, { name: event.target.value })}
              placeholder={`İçerik adı (örn. ${topicIndex + 1}. Ünite)`}
              className="flex-1 rounded-xl border border-panel-border p-2 text-sm font-semibold text-panel-text"
            />
            {topics.length > 1 ? (
              <button
                type="button"
                aria-label="İçeriği sil"
                onClick={() => removeTopic(topic.id)}
                className="shrink-0 rounded-full p-1.5 text-panel-text-muted hover:bg-panel-accent-soft hover:text-panel-warm"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            {topic.tests.map((test) => (
              <div key={test.id} className="grid grid-cols-2 gap-2 rounded-lg bg-panel-surface-soft p-2 sm:grid-cols-5">
                <input
                  value={test.topicName}
                  onChange={(event) => updateTest(topic.id, test.id, { topicName: event.target.value })}
                  placeholder="Test konusu"
                  className="col-span-2 rounded-lg border border-panel-border p-1.5 text-xs text-panel-text sm:col-span-1"
                />
                <input
                  value={test.name}
                  onChange={(event) => updateTest(topic.id, test.id, { name: event.target.value })}
                  placeholder="Test adı"
                  className="col-span-2 rounded-lg border border-panel-border p-1.5 text-xs text-panel-text sm:col-span-1"
                />
                <input
                  type="number"
                  min="1"
                  value={test.pageCount}
                  onChange={(event) => updateTest(topic.id, test.id, { pageCount: event.target.value })}
                  placeholder="Sayfa sayısı"
                  className="rounded-lg border border-panel-border p-1.5 text-xs text-panel-text"
                />
                <input
                  type="number"
                  min="1"
                  value={test.questionCount}
                  onChange={(event) => updateTest(topic.id, test.id, { questionCount: event.target.value })}
                  placeholder="Soru sayısı"
                  className="rounded-lg border border-panel-blue bg-panel-blue-soft p-1.5 text-xs text-panel-text"
                />
                {topic.tests.length > 1 ? (
                  <button
                    type="button"
                    aria-label="Testi sil"
                    onClick={() => removeTest(topic.id, test.id)}
                    className="flex items-center justify-center rounded-lg text-panel-text-muted hover:text-panel-warm"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addTest(topic.id)}
              className="inline-flex w-fit items-center gap-1 text-xs font-medium text-panel-blue hover:underline"
            >
              <Plus size={12} aria-hidden="true" />
              Test Ekle
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addTopic}
        className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-dashed border-panel-border px-3 py-2 text-sm font-medium text-panel-text-muted hover:border-panel-blue hover:text-panel-blue"
      >
        <Plus size={14} aria-hidden="true" />
        İçerik Ekle
      </button>
    </div>
  )
}
