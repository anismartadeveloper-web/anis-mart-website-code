'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarDays, Check, CircleAlert, LoaderCircle, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { AvatarUploader } from '@/components/account/avatar-uploader'
import { ChangePasswordDialog } from '@/components/account/change-password-dialog'
import { profileFormSchema, usernameSchema, type ProfileFormValues } from '@/lib/account/profile-schema'

type Availability = 'checking' | 'available' | 'taken' | 'invalid' | 'error' | null

function todayLocal() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

async function readMessage(response: Response) {
  const body = await response.json().catch(() => null) as { message?: string } | null
  return body?.message ?? 'Perubahan belum berhasil disimpan. Coba lagi.'
}

export function ProfileForm({ userId, email, username, displayName, birthDate, avatarUrl, role, onAvatarChange }: {
  userId: string
  email: string
  username: string
  displayName: string
  birthDate: string | null
  avatarUrl: string | null
  role: 'user' | 'admin'
  onAvatarChange: (value: string | null) => void
}) {
  const router = useRouter()
  const [availability, setAvailability] = useState<Availability>(null)
  const [savedProfile, setSavedProfile] = useState({ display_name: displayName, username, birth_date: birthDate })
  const { register, handleSubmit, watch, reset, setValue, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { display_name: displayName, username, birth_date: birthDate },
    mode: 'onBlur',
  })
  const watched = watch()
  const hasChanges = watched.display_name.trim() !== savedProfile.display_name || watched.username.trim() !== savedProfile.username || watched.birth_date !== savedProfile.birth_date

  async function checkUsername(value: string) {
    const candidate = value.trim()
    const parsed = usernameSchema.safeParse(candidate)
    if (!parsed.success) {
      setAvailability('invalid')
      return
    }
    setAvailability('checking')
    try {
      const response = await fetch(`/api/account/username?value=${encodeURIComponent(candidate)}`, { cache: 'no-store' })
      if (!response.ok) {
        setAvailability('error')
        return
      }
      const result = await response.json() as { available: boolean }
      setAvailability(result.available ? 'available' : 'taken')
    } catch {
      setAvailability('error')
    }
  }

  async function save(values: ProfileFormValues) {
    const patch: Partial<ProfileFormValues> = {}
    if (values.display_name.trim() !== savedProfile.display_name) patch.display_name = values.display_name.trim()
    if (values.username.trim() !== savedProfile.username) patch.username = values.username.trim()
    if (values.birth_date !== savedProfile.birth_date) patch.birth_date = values.birth_date
    if (!Object.keys(patch).length) return
    clearErrors('username')
    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!response.ok) {
        const message = await readMessage(response)
        if (message.toLowerCase().includes('username')) setError('username', { message })
        toast.error(message)
        return
      }
      const savedValues = { ...values, display_name: values.display_name.trim(), username: values.username.trim() }
      setSavedProfile(savedValues)
      reset(savedValues)
      setAvailability('available')
      toast.success('Perubahan profil berhasil disimpan.')
      router.refresh()
    } catch {
      toast.error('Jaringan terputus. Perubahan profil belum tersimpan.')
    }
  }

  const displayNameField = register('display_name')
  const usernameField = register('username')
  const birthDateField = register('birth_date', { setValueAs: (value) => value === '' ? null : value })

  return <div className="flex flex-col gap-5">
    <section className="rounded-3xl border border-white/10 bg-[#121218] p-5 shadow-xl shadow-black/10 sm:p-7">
      <div className="flex flex-col items-center gap-5 border-b border-white/[.07] pb-6 sm:flex-row sm:items-center">
        <AvatarUploader userId={userId} avatarUrl={avatarUrl} name={watched.display_name || username} onAvatarChange={onAvatarChange} />
        <div className="text-center sm:text-left"><p className="text-sm font-semibold text-white">Perbarui profil Anda</p><p className="mt-1 max-w-sm text-sm leading-relaxed text-gray-400">Foto ditampilkan pada menu akun. Pilih gambar JPG, PNG, atau WebP maksimal 5 MB.</p><span className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${role === 'admin' ? 'border-amber-400/20 bg-amber-400/10 text-amber-200' : 'border-blue-400/20 bg-blue-400/10 text-blue-200'}`}><ShieldCheck className="size-3.5" aria-hidden="true" />{role === 'admin' ? 'Administrator' : 'Akun pelanggan'}</span></div>
      </div>

      <form onSubmit={handleSubmit(save)} className="flex flex-col gap-5 pt-6" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-gray-200">Nama panggilan
            <span className="relative"><UserRound className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-500" aria-hidden="true" /><input {...displayNameField} maxLength={30} autoComplete="nickname" aria-invalid={Boolean(errors.display_name)} placeholder="Nama yang ingin ditampilkan" className="h-12 w-full rounded-xl border border-white/10 bg-[#0b0b0f] pl-10 pr-3 text-base text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 aria-invalid:border-rose-400/70" /></span>
            <span className="flex min-h-4 justify-between text-xs font-normal text-gray-500"><span>{errors.display_name?.message}</span><span>{watched.display_name.length}/30</span></span>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-gray-200">Username
            <input {...usernameField} maxLength={20} autoComplete="username" spellCheck={false} aria-invalid={Boolean(errors.username) || availability === 'taken'} onChange={(event) => { void usernameField.onChange(event); setAvailability(null); clearErrors('username') }} onBlur={(event) => { void usernameField.onBlur(event); void checkUsername(event.currentTarget.value) }} placeholder="contoh: anis.mart" className="h-12 rounded-xl border border-white/10 bg-[#0b0b0f] px-3 text-base text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 aria-invalid:border-rose-400/70" />
            <span className="flex min-h-4 items-center gap-1 text-xs font-normal" aria-live="polite">{errors.username?.message ? <span className="text-rose-300">{errors.username.message}</span> : availability === 'checking' ? <><LoaderCircle className="size-3 animate-spin" /><span className="text-gray-400">Memeriksa username…</span></> : availability === 'available' ? <><Check className="size-3 text-emerald-300" /><span className="text-emerald-300">Username tersedia</span></> : availability === 'taken' ? <><CircleAlert className="size-3 text-rose-300" /><span className="text-rose-300">Username sudah dipakai</span></> : availability === 'error' ? <span className="text-amber-200">Belum dapat memeriksa username. Coba lagi.</span> : <span className="text-gray-500">3–20 karakter · huruf kecil, angka, titik, atau garis bawah.</span>}</span>
          </label>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-gray-200">Tanggal lahir <span className="text-xs font-normal text-gray-500">Opsional</span>
            <span className="relative"><CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-500" aria-hidden="true" /><input {...birthDateField} type="date" max={todayLocal()} aria-invalid={Boolean(errors.birth_date)} className="h-12 w-full rounded-xl border border-white/10 bg-[#0b0b0f] px-3 pl-10 text-base text-white outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 aria-invalid:border-rose-400/70" />{watched.birth_date && <button type="button" onClick={() => { setValue('birth_date', null, { shouldDirty: true, shouldValidate: true }); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-white">Hapus</button>}</span>
            <span className="min-h-4 text-xs font-normal text-rose-300">{errors.birth_date?.message}</span>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-gray-200">Alamat email <span className="text-xs font-normal text-gray-500">Tidak dapat diubah di halaman ini</span>
            <span className="relative"><Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-500" aria-hidden="true" /><input value={email} type="email" readOnly disabled className="h-12 w-full cursor-not-allowed rounded-xl border border-white/[.07] bg-white/[.025] pl-10 pr-3 text-base text-gray-400 outline-none" /><span className="sr-only">Alamat email ini tidak dapat diubah di halaman ini.</span></span>
          </label>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2 text-sm font-medium text-gray-200"><span>Peran</span><span className="inline-flex min-h-12 w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/[.025] px-4 text-sm text-gray-300"><ShieldCheck className="size-4 text-violet-200" aria-hidden="true" />{role === 'admin' ? 'Admin' : 'Pengguna'}</span><span className="text-xs font-normal text-gray-500">Peran akun hanya dapat dilihat.</span></div>
          <div className="flex flex-col justify-end gap-3 border-t border-white/[.07] pt-5 sm:border-0 sm:pt-0"><p className="text-xs leading-relaxed text-gray-500">Perubahan profil disimpan hanya ke akun Anda.</p><ChangePasswordDialog email={email} /></div>
        </div>
        <div className="sticky bottom-0 -mx-5 mt-1 flex items-center justify-between gap-3 border-t border-white/10 bg-[#121218]/95 px-5 py-3 backdrop-blur-xl sm:-mx-7 sm:px-7"><p className="text-xs text-gray-400">{hasChanges ? 'Ada perubahan yang belum disimpan.' : 'Semua perubahan sudah tersimpan.'}</p><button type="submit" disabled={!hasChanges || isSubmitting || availability === 'checking' || availability === 'taken' || availability === 'error'} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 text-sm font-bold text-white shadow-lg shadow-violet-950/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-40">{isSubmitting ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Menyimpan…</> : 'Simpan perubahan'}</button></div>
      </form>
    </section>
  </div>
}
