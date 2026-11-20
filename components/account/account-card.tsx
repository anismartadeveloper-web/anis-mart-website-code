'use client'

import Link from 'next/link'
import { ChevronRight, ShieldCheck } from 'lucide-react'
import { AccountAvatar } from '@/components/account/account-avatar'

type AccountCardProps = {
  username: string
  displayName?: string | null
  email: string
  role: 'user' | 'admin'
  avatarUrl?: string | null
  onClick?: () => void
}

export function AccountCard({ username, displayName, email, role, avatarUrl, onClick }: AccountCardProps) {
  const name = displayName?.trim() || username || 'Pengguna'
  return <Link href="/akun" onClick={onClick} className="group flex min-h-[78px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-3 transition hover:border-violet-400/30 hover:bg-white/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400" aria-label={`Buka info akun ${name}`}>
    <AccountAvatar src={avatarUrl ?? null} name={name} size="size-11" />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-semibold text-white">{name}</span>
      <span className="mt-0.5 block truncate text-xs text-gray-400">{email}</span>
      <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${role === 'admin' ? 'border-amber-400/20 bg-amber-400/10 text-amber-200' : 'border-blue-400/20 bg-blue-400/10 text-blue-200'}`}><ShieldCheck className="size-3" aria-hidden="true" />{role === 'admin' ? 'Admin' : 'Pengguna'}</span>
    </span>
    <ChevronRight className="size-4 shrink-0 text-gray-500 transition group-hover:translate-x-0.5 group-hover:text-violet-200" aria-hidden="true" />
  </Link>
}
