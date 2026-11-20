'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, ImagePlus, LoaderCircle, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { AccountAvatar } from '@/components/account/account-avatar'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxFileSize = 5 * 1024 * 1024

async function centerCropToWebp(file: File) {
  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = new window.Image()
    image.src = sourceUrl
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Foto tidak dapat dibuka.'))
    })
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    if (!side) throw new Error('Ukuran foto tidak valid.')
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Foto tidak dapat diproses di perangkat ini.')
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 512, 512)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85))
    if (!blob) throw new Error('Foto tidak dapat dikompres. Coba pilih gambar lain.')
    return blob
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

async function apiMessage(response: Response) {
  const result = await response.json().catch(() => null) as { message?: string } | null
  return result?.message ?? 'Perubahan foto profil belum berhasil. Coba lagi.'
}

export function AvatarUploader({ userId, avatarUrl, name, onAvatarChange }: { userId: string; avatarUrl: string | null; name: string; onAvatarChange: (value: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [imageBlob, setImageBlob] = useState<Blob | null>(null)
  const [processing, setProcessing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)

  function clearPreview() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setImageBlob(null)
  }

  async function chooseFile(file?: File) {
    if (!file) return
    if (!allowedTypes.has(file.type)) {
      toast.error('Pilih foto berformat JPG, PNG, atau WebP.')
      return
    }
    if (file.size > maxFileSize) {
      toast.error('Ukuran foto maksimal 5 MB.')
      return
    }
    setProcessing(true)
    try {
      const blob = await centerCropToWebp(file)
      clearPreview()
      setImageBlob(blob)
      setPreview(URL.createObjectURL(blob))
      setOpen(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Foto tidak dapat diproses. Coba lagi.')
    } finally {
      setProcessing(false)
    }
  }

  async function savePhoto() {
    if (!imageBlob || uploading) return
    setUploading(true)
    try {
      const supabase = createClient()
      const path = `${userId}/avatar.webp`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, imageBlob, {
        upsert: true,
        contentType: 'image/webp',
        cacheControl: '3600',
      })
      if (uploadError) throw uploadError
      const publicUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      const avatarUrl = `${publicUrl}?v=${Date.now()}`
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: avatarUrl }),
      })
      if (!response.ok) throw new Error(await apiMessage(response))
      onAvatarChange(avatarUrl)
      clearPreview()
      setOpen(false)
      toast.success('Foto profil berhasil diperbarui.')
    } catch (error) {
      const message = error instanceof Error && (error.message.toLowerCase().includes('permission') || error.message.toLowerCase().includes('row-level security'))
        ? 'Izin mengunggah foto ditolak. Pastikan Anda masuk ke akun yang benar.'
        : error instanceof Error && (error.message.toLowerCase().includes('fetch') || error.message.toLowerCase().includes('network'))
          ? 'Jaringan terputus. Periksa koneksi lalu coba lagi.'
          : error instanceof Error && error.message !== 'Failed to fetch'
            ? error.message
            : 'Foto gagal diunggah. Periksa koneksi dan coba lagi.'
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  async function removePhoto() {
    if (uploading) return
    setUploading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.storage.from('avatars').remove([`${userId}/avatar.webp`])
      if (error && !error.message.toLowerCase().includes('not found')) throw error
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: null }),
      })
      if (!response.ok) throw new Error(await apiMessage(response))
      onAvatarChange(null)
      setOpen(false)
      toast.success('Foto profil berhasil dihapus.')
    } catch {
      toast.error('Foto profil belum dapat dihapus. Coba lagi saat koneksi stabil.')
    } finally {
      setUploading(false)
    }
  }

  function selectSource(input: React.RefObject<HTMLInputElement | null>) {
    setOpen(false)
    input.current?.click()
  }

  return <div className="flex flex-col items-center">
    <div className="relative">
      <AccountAvatar src={preview ?? avatarUrl} name={name} size="size-28 sm:size-32" />
      {processing && <span className="absolute inset-0 grid place-items-center rounded-full bg-black/65 text-xs font-medium text-white">Memproses</span>}
      <button type="button" onClick={() => setOpen(true)} disabled={uploading || processing} aria-label="Ubah foto profil" className="absolute bottom-0 right-0 grid size-10 place-items-center rounded-full border-4 border-[#121218] bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:opacity-60"><Camera className="size-4" aria-hidden="true" /></button>
    </div>
    <p className="mt-3 text-xs text-gray-400">Foto profil</p>
    <input ref={cameraInput} type="file" accept="image/*" capture="user" className="sr-only" aria-label="Ambil foto dengan kamera" onChange={(event) => { void chooseFile(event.target.files?.[0]); event.currentTarget.value = '' }} />
    <input ref={galleryInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Pilih foto dari galeri" onChange={(event) => { void chooseFile(event.target.files?.[0]); event.currentTarget.value = '' }} />

    <Sheet open={open} onOpenChange={(value) => { setOpen(value); if (!value) clearPreview() }}>
      <SheetContent side="bottom" showCloseButton={false} className="max-h-[90svh] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#111119] p-5 text-white sm:inset-x-0 sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:h-fit sm:max-h-[90vh] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border">
        <SheetHeader className="p-0 pr-10"><SheetTitle className="text-lg font-bold text-white">Foto profil</SheetTitle><SheetDescription className="text-sm text-gray-400">Pilih gambar JPG, PNG, atau WebP hingga 5 MB.</SheetDescription></SheetHeader>
        <button type="button" onClick={() => { clearPreview(); setOpen(false) }} aria-label="Tutup pilihan foto" className="absolute right-4 top-4 grid size-10 place-items-center rounded-xl text-gray-400 hover:bg-white/10 hover:text-white"><X className="size-5" /></button>
        {preview ? <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[.03] p-4"><Image src={preview} alt="Pratinjau foto yang sudah dipotong persegi" width={160} height={160} unoptimized className="size-40 rounded-full border border-violet-400/30 object-cover" /><p className="text-center text-xs text-gray-400">Pratinjau otomatis dipotong persegi dari bagian tengah.</p><div className="flex w-full gap-2"><button type="button" onClick={() => { clearPreview(); cameraInput.current?.click() }} className="min-h-11 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium hover:bg-white/10">Pilih ulang</button><button type="button" onClick={() => { void savePhoto() }} disabled={uploading} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-3 text-sm font-semibold disabled:opacity-60">{uploading ? <><LoaderCircle className="size-4 animate-spin" />Mengunggah…</> : <><Upload className="size-4" />Gunakan foto</>}</button></div>{uploading && <div className="w-full" role="progressbar" aria-label="Mengunggah foto profil" aria-valuetext="Sedang mengunggah foto"><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-2/5 animate-pulse rounded-full bg-gradient-to-r from-blue-500 to-violet-500" /></div><p className="mt-2 text-center text-xs text-gray-400">Mengunggah foto…</p></div>}</div> : <div className="flex flex-col gap-2 pt-1"><button type="button" onClick={() => selectSource(cameraInput)} className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-white/[.035] px-4 text-left transition hover:bg-white/[.08]"><span className="grid size-10 place-items-center rounded-xl bg-blue-500/15 text-blue-200"><Camera className="size-5" /></span><span><span className="block text-sm font-semibold">Ambil dari kamera</span><span className="text-xs text-gray-400">Gunakan kamera depan perangkat</span></span></button><button type="button" onClick={() => selectSource(galleryInput)} className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-white/[.035] px-4 text-left transition hover:bg-white/[.08]"><span className="grid size-10 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><ImagePlus className="size-5" /></span><span><span className="block text-sm font-semibold">Pilih dari galeri</span><span className="text-xs text-gray-400">JPG, PNG, atau WebP · maks. 5 MB</span></span></button>{avatarUrl && <button type="button" onClick={() => { void removePhoto() }} disabled={uploading} className="flex min-h-12 items-center gap-3 rounded-xl px-4 text-left text-sm font-semibold text-rose-300 transition hover:bg-rose-400/10 disabled:opacity-60"><Trash2 className="size-4" />Hapus foto</button>}</div>}
      </SheetContent>
    </Sheet>
  </div>
}
