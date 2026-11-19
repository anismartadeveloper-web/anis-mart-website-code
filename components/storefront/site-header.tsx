'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, House, LogOut, Menu, PackageSearch, Search, ShieldCheck, ShoppingBag, Sparkles, UserRound, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type SiteHeaderProps = { username: string; email: string; role: 'user' | 'admin'; onSearch: (value: string) => void }

export function SiteHeader({ username, email, role, onSearch }: SiteHeaderProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      requestAnimationFrame(() => closeRef.current?.focus())
    } else if (!open && dialog.open) {
      dialog.close()
      menuRef.current?.focus()
    }
  }, [open])

  async function logout() {
    setPending(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return <>
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0b0f]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-20 lg:px-8">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="Anis Mart, ke beranda"><span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg shadow-purple-900/30 transition-transform group-hover:scale-105"><Sparkles className="size-5" aria-hidden="true" /></span><span className="font-display text-xl font-extrabold tracking-tight md:text-2xl">Anis<span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">Mart</span></span></Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-gray-300 md:flex" aria-label="Navigasi utama"><a href="#beranda" className="transition hover:text-white">Beranda</a><a href="#katalog" className="transition hover:text-white">Katalog</a><a href="#promo" className="transition hover:text-white">Promo Kombo</a><a href="#cara-pesan" className="transition hover:text-white">Cara Pesan</a></nav>
        <label className="relative ml-auto hidden w-full max-w-[230px] md:block"><span className="sr-only">Cari produk</span><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" /><input onChange={(event) => onSearch(event.target.value)} type="search" placeholder="Cari snack, minuman..." className="h-10 w-full rounded-full border border-white/10 bg-[#121218] pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" /></label>
        <button ref={menuRef} type="button" onClick={() => setOpen(true)} className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#121218] text-gray-200 transition hover:border-violet-500/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400" aria-label="Buka menu navigasi"><Menu className="size-5" aria-hidden="true" /></button>
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-3 sm:px-6 md:hidden"><label className="relative block"><span className="sr-only">Cari produk</span><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" /><input onChange={(event) => onSearch(event.target.value)} type="search" placeholder="Cari snack, minuman..." className="h-10 w-full rounded-full border border-white/10 bg-[#121218] pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" /></label></div>
    </header>
    <dialog ref={dialogRef} aria-label="Menu akun" onCancel={() => setOpen(false)} onClick={(event) => { if (event.target === dialogRef.current) setOpen(false) }} className="fixed inset-0 m-0 ml-auto h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 text-white backdrop:bg-black/65 backdrop:backdrop-blur-sm sm:max-w-[390px]">
      <aside className="drawer-panel ml-auto flex h-full w-full max-w-[390px] flex-col border-l border-white/10 bg-[#101016] shadow-2xl shadow-black/50" aria-label="Navigasi akun">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600"><Sparkles className="size-4" aria-hidden="true" /></span><span className="font-display text-lg font-extrabold">Anis<span className="text-violet-300">Mart</span></span></div><button ref={closeRef} type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-lg text-gray-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400" aria-label="Tutup menu"><X className="size-5" aria-hidden="true" /></button></div>
        <div className="border-b border-white/10 p-5"><div className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-full border border-violet-400/20 bg-violet-500/15 text-violet-200"><UserRound className="size-5" aria-hidden="true" /></span><div className="min-w-0"><p className="truncate font-semibold text-white">{username}</p><p className="truncate text-xs text-gray-400">{email}</p></div></div><span className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${role === 'admin' ? 'border-amber-400/20 bg-amber-400/10 text-amber-200' : 'border-blue-400/20 bg-blue-400/10 text-blue-200'}`}><ShieldCheck className="size-3.5" aria-hidden="true" />{role === 'admin' ? 'Admin' : 'Pengguna'}</span></div>
        <nav className="flex flex-col gap-1 p-3" aria-label="Menu akun"><a href="#beranda" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-gray-200 transition hover:bg-white/5 hover:text-white"><House className="size-4 text-blue-300" aria-hidden="true" />Beranda</a><a href="#katalog" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-gray-200 transition hover:bg-white/5 hover:text-white"><PackageSearch className="size-4 text-violet-300" aria-hidden="true" />Katalog</a>{role === 'admin' && <Link href="/admin" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-gray-200 transition hover:bg-white/5 hover:text-white"><ShieldCheck className="size-4 text-amber-300" aria-hidden="true" />Admin Console<ArrowRight className="ml-auto size-4 text-gray-500" aria-hidden="true" /></Link>}</nav>
        <div className="mt-auto border-t border-white/10 p-4"><button type="button" onClick={logout} disabled={pending} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-400/15 bg-red-500/10 px-4 text-sm font-semibold text-red-200 transition hover:bg-red-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-60"><LogOut className="size-4" aria-hidden="true" />{pending ? 'Keluar...' : 'Logout'}</button></div>
      </aside>
    </dialog>
  </>
}
