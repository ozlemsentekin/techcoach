import { useState } from 'react'
import { NotebookPen } from 'lucide-react'
import { getHomeworks, addHomework } from '../../../services/homeworkService'
import PageHeader from '../../layout/PageHeader'
import EmptyState from '../../shared/EmptyState'
import HomeworkCard from '../../student/components/HomeworkCard'
import AddHomeworkModal from '../../student/components/AddHomeworkModal'

export default function HomeworkPage() {
  const [homeworks, setHomeworks] = useState(() => getHomeworks())
  const [showModal, setShowModal] = useState(false)

  const handleSave = (payload) => {
    addHomework(payload)
    setHomeworks(getHomeworks())
    setShowModal(false)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader
        title="Ödevler"
        subtitle="Aylin'in okuldan verilen ödevlerini buradan takip et ve ekle."
        actions={
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-panel-blue px-4 py-2.5 text-sm font-semibold text-white"
          >
            + Ödev Ekle
          </button>
        }
      />

      {homeworks.length === 0 ? (
        <EmptyState icon={NotebookPen} title="Henüz ödev eklenmedi" description="Yukarıdaki butonla ilk ödevi ekleyebilirsin." />
      ) : (
        <div className="flex flex-col gap-3">
          {homeworks.map((homework) => (
            <HomeworkCard key={homework.id} homework={homework} />
          ))}
        </div>
      )}

      {showModal ? <AddHomeworkModal onSave={handleSave} onClose={() => setShowModal(false)} /> : null}
    </div>
  )
}
