'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, House, LogOut, Menu, PackageSearch, Search, ShieldCheck, ShoppingBag, X } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { AccountCard } from '@/components/account/account-card'
import { createClient } from '@/lib/supabase/client'

type SiteHeaderProps = { username: string; displayName: string; email: string; role: 'user' | 'admin'; avatarUrl: string | null; onSearch: (value: string) => void }

export function SiteHeader({ username, displayName, email, role, avatarUrl, onSearch }: SiteHeaderProps) {
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
        <Link href="/" className="group flex shrink-0 items-center" aria-label="Anis Mart, ke beranda"><BrandLogo variant="header" /></Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-gray-300 md:flex" aria-label="Navigasi utama"><a href="#beranda" className="transition hover:text-white">Beranda</a><a href="#katalog" className="transition hover:text-white">Katalog</a><a href="#promo" className="transition hover:text-white">Promo Kombo</a><a href="#cara-pesan" className="transition hover:text-white">Cara Pesan</a></nav>
        <label className="relative ml-auto hidden w-full max-w-[230px] md:block"><span className="sr-only">Cari produk</span><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" /><input onChange={(event) => onSearch(event.target.value)} type="search" placeholder="Cari snack, minuman..." className="h-10 w-full rounded-full border border-white/10 bg-[#121218] pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" /></label>
        <button ref={menuRef} type="button" onClick={() => setOpen(true)} className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#121218] text-gray-200 transition hover:border-violet-500/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400" aria-label="Buka menu navigasi"><Menu className="size-5" aria-hidden="true" /></button>
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-3 sm:px-6 md:hidden"><label className="relative block"><span className="sr-only">Cari produk</span><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" /><input onChange={(event) => onSearch(event.target.value)} type="search" placeholder="Cari snack, minuman..." className="h-10 w-full rounded-full border border-white/10 bg-[#121218] pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" /></label></div>
    </header>
    <dialog ref={dialogRef} aria-label="Menu akun" onCancel={() => setOpen(false)} onClick={(event) => { if (event.target === dialogRef.current) setOpen(false) }} className="fixed inset-0 m-0 ml-auto h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 text-white backdrop:bg-black/65 backdrop:backdrop-blur-sm sm:max-w-[390px]">
      <aside className="drawer-panel ml-auto flex h-full w-full max-w-[390px] flex-col border-l border-white/10 bg-[#101016] shadow-2xl shadow-black/50" aria-label="Navigasi akun">
        <div className="flex min-h-32 items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><Link href="/" onClick={() => setOpen(false)} className="flex min-w-0 items-center" aria-label="Anis Mart, ke beranda"><BrandLogo variant="sidebar" /></Link><button ref={closeRef} type="button" onClick={() => setOpen(false)} className="grid size-11 shrink-0 place-items-center rounded-lg text-gray-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400" aria-label="Tutup menu"><X className="size-5" aria-hidden="true" /></button></div>
        <div className="border-b border-white/10 p-5"><AccountCard username={username} displayName={displayName} email={email} role={role} avatarUrl={avatarUrl} onClick={() => setOpen(false)} /></div>
        <nav className="flex flex-col gap-1 p-3" aria-label="Menu akun"><a href="#beranda" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-gray-200 transition hover:bg-white/5 hover:text-white"><House className="size-4 text-blue-300" aria-hidden="true" />Beranda</a><a href="#katalog" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-gray-200 transition hover:bg-white/5 hover:text-white"><PackageSearch className="size-4 text-violet-300" aria-hidden="true" />Katalog</a><Link href="/pesanan-saya" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-gray-200 transition hover:bg-white/5 hover:text-white"><PackageSearch className="size-4 text-blue-300" aria-hidden="true" />Pesanan Saya<ArrowRight className="ml-auto size-4 text-gray-500" aria-hidden="true" /></Link>{role === 'admin' && <Link href="/admin" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-gray-200 transition hover:bg-white/5 hover:text-white"><ShieldCheck className="size-4 text-amber-300" aria-hidden="true" />Admin Console<ArrowRight className="ml-auto size-4 text-gray-500" aria-hidden="true" /></Link>}</nav>
        <div className="mt-auto border-t border-white/10 p-4"><button type="button" onClick={logout} disabled={pending} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-400/15 bg-red-500/10 px-4 text-sm font-semibold text-red-200 transition hover:bg-red-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-60"><LogOut className="size-4" aria-hidden="true" />{pending ? 'Keluar...' : 'Logout'}</button></div>
      </aside>
    </dialog>
  </>
}
