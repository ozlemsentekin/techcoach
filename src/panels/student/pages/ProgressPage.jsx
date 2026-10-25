import PageHeader from '../../layout/PageHeader'
import SubjectProgressAnalysis from '../../shared/SubjectProgressAnalysis'

// Öğrenci "Gelişimim": velinin Gelişim Analizi ile aynı ders bazlı görünüm (kendi verisi).
export default function ProgressPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Gelişimim" subtitle="Tüm derslerinin emek, doğruluk ve kaynak ilerlemesi." />
      <SubjectProgressAnalysis studentName="Senin" />
    </div>
  )
}
