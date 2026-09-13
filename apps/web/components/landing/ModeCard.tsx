import type { ReactNode } from 'react'
import { ModeBadge } from '@/components/shared/ModeBadge'

type PaymentMode = 'x402' | 'mpp-charge' | 'mpp-session'

interface ModeCardProps {
  mode: PaymentMode
  title: string
  description: string
  icon: ReactNode
  stats: string
}

export function ModeCard({ mode, title, description, icon, stats }: ModeCardProps) {
  return (
    <div className="group rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 transition-all hover:border-[var(--accent)]/30 hover:bg-[var(--bg-subtle)] flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
          {icon}
        </div>
        <ModeBadge mode={mode} />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-[var(--text-primary)] mb-1">{title}</h3>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">{description}</p>
      </div>
      <div className="border-t border-[var(--border-default)] pt-4">
        <p className="text-sm font-mono font-bold text-[var(--accent)]">{stats}</p>
      </div>
    </div>
  )
}
