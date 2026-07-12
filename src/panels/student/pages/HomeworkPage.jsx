import { useState } from 'react'
import { getHomeworks, addHomework } from '../../../services/homeworkService'
import PageHeader from '../../layout/PageHeader'
import HomeworkCard from '../components/HomeworkCard'
import AddHomeworkModal from '../components/AddHomeworkModal'
import EmptyState from '../../shared/EmptyState'

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
        title="Ödevlerim"
        subtitle="Okuldan verilen ödevlerini burada takip edebilirsin."
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
        <EmptyState
          title="Henüz ödev eklenmedi"
          description="Bugünkü planlama görevinden veya buradan yeni bir ödev ekleyebilirsin."
        />
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
