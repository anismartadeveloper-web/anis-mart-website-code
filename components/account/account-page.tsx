'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react'
import { ProfileForm } from '@/components/account/profile-form'

type AccountProfile = {
  id: string
  username: string
  displayName: string
  birthDate: string | null
  avatarUrl: string | null
  email: string
  role: 'user' | 'admin'
}

export function AccountPage({ profile }: { profile: AccountProfile }) {
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl)
  const router = useRouter()

  function updateAvatar(value: string | null) {
    setAvatarUrl(value)
    router.refresh()
  }

  return <main className="min-h-screen bg-[#0b0b0f] px-4 pb-12 pt-6 text-white sm:px-6 sm:pt-10">
    <div className="mx-auto w-full max-w-2xl">
      <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-gray-400 transition hover:bg-white/[.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"><ArrowLeft className="size-4" aria-hidden="true" />Kembali</Link>
      <header className="mb-6 mt-5 rounded-3xl border border-white/[.07] bg-gradient-to-br from-[#171520] via-[#111119] to-[#0e1018] p-5 sm:mb-8 sm:mt-6 sm:p-8"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-violet-300/15 bg-violet-500/10 text-violet-200"><ShieldCheck className="size-5" aria-hidden="true" /></span><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-200">Pengaturan pribadi</p><h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Info Akun</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-400">Perbarui nama, username, tanggal lahir, dan foto untuk akun Anda. Email tetap terlindungi dan tidak dapat diedit di sini.</p></div></div><div className="mt-5 flex items-start gap-2 rounded-xl border border-blue-400/15 bg-blue-400/[.06] px-3.5 py-3 text-xs leading-relaxed text-blue-100/80"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-blue-200" aria-hidden="true" /><p>Hanya akun Anda yang dapat melihat dan mengubah data profil ini.</p></div></header>
      <ProfileForm userId={profile.id} email={profile.email} username={profile.username} displayName={profile.displayName} birthDate={profile.birthDate} avatarUrl={avatarUrl} role={profile.role} onAvatarChange={updateAvatar} />
      <p className="mt-6 text-center text-xs text-gray-600">Anis Mart · Pengaturan profil akun</p>
    </div>
  </main>
}
