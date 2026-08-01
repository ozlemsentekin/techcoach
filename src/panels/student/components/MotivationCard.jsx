import { Sparkles, Heart, Mail, BookOpen, Leaf } from 'lucide-react'

const ICONS = {
  sparkle: Sparkles,
  heart: Heart,
  letter: Mail,
  book: BookOpen,
  leaf: Leaf,
}

export default function MotivationCard({ message }) {
  if (!message) return null

  const Icon = ICONS[message.iconType] || Sparkles

  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-r from-[#EAF0FF] via-[#F1ECFE] to-[#FDEEF8] px-5 py-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_4px_14px_rgba(62,123,250,0.22)]">
        <Icon size={22} className="text-[#3E7BFA]" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        {message.title ? (
          <p className="bg-gradient-to-r from-[#3E7BFA] to-[#8B5CF6] bg-clip-text text-[17px] font-extrabold leading-snug text-transparent">
            {message.title}
          </p>
        ) : null}
        <p className="mt-0.5 text-[13px] text-[#5B6178]">{message.body}</p>
      </div>
    </div>
  )
}
