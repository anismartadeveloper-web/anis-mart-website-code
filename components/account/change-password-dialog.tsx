'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, KeyRound, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { passwordChangeSchema } from '@/lib/account/profile-schema'

const passwordFields = [
  { key: 'current_password', label: 'Kata sandi saat ini', autoComplete: 'current-password' },
  { key: 'new_password', label: 'Kata sandi baru', autoComplete: 'new-password' },
  { key: 'confirm_password', label: 'Konfirmasi kata sandi baru', autoComplete: 'new-password' },
] as const

type PasswordKey = typeof passwordFields[number]['key']
type PasswordValues = { current_password: string; new_password: string; confirm_password: string }
const emptyPassword: PasswordValues = { current_password: '', new_password: '', confirm_password: '' }

export function ChangePasswordDialog({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState<Record<PasswordKey, boolean>>({ current_password: false, new_password: false, confirm_password: false })
  const { register, handleSubmit, reset, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<PasswordValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: emptyPassword,
    mode: 'onBlur',
  })

  function closeDialog(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      reset(emptyPassword)
      setVisible({ current_password: false, new_password: false, confirm_password: false })
    }
  }

  async function submit(values: PasswordValues) {
    clearErrors()
    try {
      const supabase = createClient()
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: values.current_password })
      if (verifyError) {
        if (verifyError.code === 'invalid_credentials') {
          setError('current_password', { type: 'server', message: 'Kata sandi saat ini salah.' })
          toast.error('Kata sandi saat ini salah.')
        } else if (verifyError.status === 429) {
          setError('current_password', { type: 'server', message: 'Terlalu banyak percobaan. Tunggu sebentar.' })
          toast.error('Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.')
        } else {
          setError('current_password', { type: 'server', message: 'Kata sandi saat ini belum dapat diverifikasi.' })
          toast.error('Kata sandi saat ini belum dapat diverifikasi. Coba lagi.')
        }
        return
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: values.new_password })
      if (updateError) {
        const message = updateError.message.toLowerCase().includes('password') ? 'Kata sandi baru belum memenuhi ketentuan Supabase.' : 'Kata sandi gagal diperbarui. Coba lagi.'
        setError('new_password', { type: 'server', message })
        toast.error(message)
        return
      }
      toast.success('Kata sandi berhasil diganti.')
      closeDialog(false)
    } catch {
      toast.error('Terjadi kendala koneksi. Kata sandi belum berubah.')
    }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 text-sm font-semibold text-gray-100 transition hover:border-violet-400/30 hover:bg-white/[.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"><KeyRound className="size-4 text-violet-200" aria-hidden="true" />Ganti kata sandi</button>
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-h-[90svh] max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-[#121218] p-5 text-white sm:p-6" showCloseButton>
        <DialogHeader><DialogTitle className="font-display text-xl font-bold">Ganti kata sandi</DialogTitle><DialogDescription className="text-sm text-gray-400">Verifikasi kata sandi saat ini sebelum menyimpan yang baru.</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
          {passwordFields.map(({ key, label, autoComplete }) => <label key={key} htmlFor={key} className="flex flex-col gap-2 text-sm font-medium text-gray-200">{label}<span className="relative block"><input id={key} {...register(key)} type={visible[key] ? 'text' : 'password'} autoComplete={autoComplete} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined} className="h-12 w-full rounded-xl border border-white/10 bg-[#0b0b0f] px-4 pr-12 text-base text-white outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 aria-invalid:border-rose-400/70" /><button type="button" onClick={() => setVisible((current) => ({ ...current, [key]: !current[key] }))} aria-label={visible[key] ? `Sembunyikan ${label.toLowerCase()}` : `Tampilkan ${label.toLowerCase()}`} aria-pressed={visible[key]} className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-gray-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">{visible[key] ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button></span>{errors[key]?.message && <span id={`${key}-error`} className="text-xs font-normal text-rose-300">{errors[key]?.message}</span>}</label>)}
          <p className="text-xs text-gray-500">Kata sandi tidak disimpan di profil atau dicatat di log.</p>
          <button type="submit" disabled={isSubmitting} className="mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? <><LoaderCircle className="size-4 animate-spin" />Memverifikasi…</> : 'Simpan kata sandi baru'}</button>
        </form>
      </DialogContent>
    </Dialog>
  </>
}
