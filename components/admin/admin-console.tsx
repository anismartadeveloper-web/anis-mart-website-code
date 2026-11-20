'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useFormStatus } from 'react-dom'
import { ArrowLeft, Boxes, ChartNoAxesCombined, CircleAlert, ClipboardList, ExternalLink, Menu, PackagePlus, Settings2, ShoppingBag, Users } from 'lucide-react'
import { setCustomerActive, updateOrderStatus } from '@/app/admin/actions'
import { ProductManager } from '@/components/admin/product-manager'
import { StoreSettingsPanel } from '@/components/admin/store-settings-panel'
import { AccountCard } from '@/components/account/account-card'
import { AccountAvatar } from '@/components/account/account-avatar'
import { BrandLogo } from '@/components/brand-logo'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type Product = { id: string; sku: string; name: string; category: 'Snack' | 'Minuman'; price: number; promo_price: number | null; extra_shipping_fee: number; stock: number; is_active: boolean; image_url: string | null; image_path: string | null; description: string | null; unit_size: number | null; unit_label: string | null; unit_note: string | null; created_at: string }
type Customer = { id: string; is_active: boolean; created_at: string }
type OrderItem = { quantity: number; price: number; products: { name: string } | null }
type Order = { id: string; user_id: string; subtotal: number; shipping_fee: number; total_price: number; shipping_address: string; delivery_method: string; payment_method: string; payment_status: string; status: string; created_at: string; profiles: { username: string } | null; order_items: OrderItem[] }
type StoreSettings = { id: boolean; store_name: string; store_lat: number; store_lng: number; store_address: string; tarif_dasar: number; tarif_per_km: number; jarak_gratis_km: number; maks_jarak_km: number; ongkir_minimum: number; gratis_ongkir_min_belanja: number | null; updated_at: string }
type PaymentMethod = { id: string; label: string; deskripsi: string; is_active: boolean; urutan: number }
type AdminConsoleProps = { username: string; displayName: string; email: string; avatarUrl: string | null; products: Product[]; orders: Order[]; customers: Customer[]; settings: StoreSettings; paymentMethods: PaymentMethod[]; error?: string }

const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
const date = (value: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const statusText: Record<string, string> = { pending: 'Menunggu', diproses: 'Diproses', selesai: 'Selesai', dibatalkan: 'Dibatalkan' }
const statusTone: Record<string, string> = { pending: 'border-amber-400/20 bg-amber-400/10 text-amber-200', diproses: 'border-blue-400/20 bg-blue-400/10 text-blue-200', selesai: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200', dibatalkan: 'border-rose-400/20 bg-rose-400/10 text-rose-200' }
const fieldClass = 'min-h-11 w-full rounded-xl border border-white/10 bg-[#0b0b0f] px-3.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20'
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60'

function SubmitButton({ children = 'Simpan' }: { children?: ReactNode }) {
  const { pending } = useFormStatus()
  return <button disabled={pending} className={buttonClass}>{pending ? 'Menyimpan…' : children}</button>
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-300">{eyebrow}</p><h2 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">{title}</h2><p className="mt-2 text-sm text-gray-400">{text}</p></div>
}



export function AdminConsole({ username, displayName, email, avatarUrl, products, orders, customers, settings, paymentMethods, error }: AdminConsoleProps) {
  const [section, setSection] = useState('Overview')
  const [statusFilter, setStatusFilter] = useState('semua')
  const sections = [
    { name: 'Overview', icon: ChartNoAxesCombined },
    { name: 'Produk', icon: Boxes },
    { name: 'Pesanan', icon: ClipboardList },
    { name: 'Manajemen Pelanggan', icon: Users },
    { name: 'Pengaturan', icon: Settings2 },
  ]
  const lowStock = products.filter((product) => product.stock <= 10).sort((a, b) => a.stock - b.stock)
  const filteredOrders = statusFilter === 'semua' ? orders : orders.filter((order) => order.status === statusFilter)

  return <div className="min-h-screen bg-[#0b0b0f] text-white">
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0b0f]/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Anis Mart, ke beranda"><BrandLogo variant="header" /></Link>
        <div className="flex min-w-0 items-center gap-2"><span className="hidden text-sm text-gray-400 sm:block">Halo, {displayName}</span><Link href="/akun" aria-label="Buka info akun" className="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 transition hover:border-violet-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"><AccountAvatar src={avatarUrl} name={displayName} size="size-8" /></Link><Link href="/" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 text-xs font-semibold text-gray-200 transition hover:bg-white/10 sm:gap-2 sm:px-4 sm:text-sm"><ExternalLink className="size-4" />Lihat Toko</Link></div>
      </div>
      <div className="mx-auto flex max-w-[1500px] justify-end px-4 pb-3 lg:hidden">
        <Sheet>
          <SheetTrigger render={<button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-gray-200"><Menu className="size-4" />Navigasi admin</button>} />
          <SheetContent side="left" className="border-white/10 bg-[#101016] text-white">
            <SheetHeader className="min-h-32 flex-row items-center border-b border-white/10 pr-16"><BrandLogo variant="sidebar" /><SheetTitle className="sr-only">Menu Admin</SheetTitle></SheetHeader>
            <div className="px-4 pb-3"><AccountCard username={username} displayName={displayName} email={email} role="admin" avatarUrl={avatarUrl} /></div>
            <nav className="flex flex-col gap-1 px-4" aria-label="Navigasi Admin Console">{sections.map(({ name, icon: Icon }) => <SheetClose key={name} render={<button type="button" onClick={() => setSection(name)} aria-current={section === name ? 'page' : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium ${section === name ? 'bg-violet-500/20 text-violet-100' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`} />}><Icon className="size-4" />{name}</SheetClose>)}</nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
    <div className="mx-auto flex max-w-[1500px]">
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col border-r border-white/10 p-4 lg:flex">
        <AccountCard username={username} displayName={displayName} email={email} role="admin" avatarUrl={avatarUrl} />
        <p className="px-3 pb-3 pt-5 text-[10px] font-bold uppercase tracking-[.2em] text-gray-500">Menu Admin</p>
        <nav className="flex flex-col gap-1" aria-label="Navigasi Admin Console">{sections.map(({ name, icon: Icon }) => <button key={name} onClick={() => setSection(name)} aria-current={section === name ? 'page' : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition ${section === name ? 'bg-gradient-to-r from-blue-600/20 to-violet-600/20 text-white ring-1 ring-violet-400/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}><Icon className={`size-4 ${section === name ? 'text-violet-300' : ''}`} />{name}</button>)}</nav>
        <Link href="/" className="mt-auto flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-gray-400 transition hover:bg-white/5 hover:text-white"><ArrowLeft className="size-4" />Lihat Toko</Link>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-7 sm:px-6 sm:py-9 lg:px-10">
        {error && <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200"><CircleAlert className="mt-0.5 size-4 shrink-0" />{error}</div>}
        {section === 'Overview' && <>
          <SectionTitle eyebrow="Ringkasan toko" title="Overview" text="Pantau inventaris dan aktivitas pesanan Anis Mart." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-[#121218] p-5"><div className="flex items-center justify-between"><span className="text-sm text-gray-400">Produk dijual</span><Boxes className="size-5 text-blue-300" /></div><p className="mt-4 font-display text-3xl font-extrabold">{products.length}</p><p className="mt-1 text-xs text-gray-500">Produk aktif di katalog</p></article>
            <article className="rounded-2xl border border-white/10 bg-[#121218] p-5"><div className="flex items-center justify-between"><span className="text-sm text-gray-400">Total pesanan</span><ShoppingBag className="size-5 text-violet-300" /></div><p className="mt-4 font-display text-3xl font-extrabold">{orders.length}</p><p className="mt-1 text-xs text-gray-500">Seluruh pelanggan</p></article>
            <article className="rounded-2xl border border-white/10 bg-[#121218] p-5 sm:col-span-2 xl:col-span-1"><div className="flex items-center justify-between"><span className="text-sm text-gray-400">Stok menipis</span><CircleAlert className="size-5 text-amber-300" /></div><p className="mt-4 font-display text-3xl font-extrabold">{lowStock.length}</p><p className="mt-1 text-xs text-gray-500">Produk dengan stok ≤ 10</p></article>
          </div>
          <section className="mt-6 rounded-2xl border border-white/10 bg-[#121218] p-4 sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-display text-lg font-bold">Stok perlu perhatian</h3><p className="mt-1 text-xs text-gray-400">Urut dari stok paling sedikit</p></div><span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">{lowStock.length} produk</span></div>
            {lowStock.length === 0 ? <p className="rounded-xl border border-white/5 bg-white/[.02] p-5 text-sm text-gray-400">Semua stok produk aman.</p> : <div className="flex flex-col divide-y divide-white/5">{lowStock.map((product) => <div key={product.id} className="flex items-center gap-3 py-3"><div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20">{product.image_url ? <Image src={product.image_url} alt={product.name} width={44} height={44} unoptimized className="size-11 object-cover" /> : <PackagePlus className="size-5 text-violet-200" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{product.name}</p><p className="text-xs text-gray-500">{product.category}</p></div><span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-200">Stok {product.stock}</span></div>)}</div>}
          </section>
        </>}

        {section === 'Produk' && <>
          <SectionTitle eyebrow="Katalog & inventaris" title="Produk" text="Tambahkan produk baru atau perbarui katalog dan stok yang tersedia." />
          <ProductManager products={products} />
        </>}

        {section === 'Pesanan' && <>
          <SectionTitle eyebrow="Operasional toko" title="Pesanan" text="Lihat detail pesanan pelanggan dan perbarui status pemrosesannya." />
          <label className="mb-4 flex max-w-xs flex-col gap-1.5 text-xs font-medium text-gray-300">Filter status<select className={fieldClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="semua">Semua status</option>{Object.entries(statusText).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {filteredOrders.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center"><ShoppingBag className="mx-auto size-8 text-gray-600" /><h3 className="mt-3 font-semibold">Belum ada pesanan</h3><p className="mt-1 text-sm text-gray-500">Pesanan pelanggan akan muncul di sini.</p></div> : <div className="grid gap-4">{filteredOrders.map((order) => <article key={order.id} className="rounded-2xl border border-white/10 bg-[#121218] p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-gray-500">{date(order.created_at)}</p><h3 className="mt-1 font-semibold">{order.profiles?.username ?? 'Pelanggan'}</h3></div><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone[order.status] ?? statusTone.pending}`}>{statusText[order.status] ?? order.status}</span></div><div className="mt-4 grid gap-4 border-t border-white/5 pt-4 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Produk</p><ul className="mt-2 flex flex-col gap-1 text-sm text-gray-200">{(order.order_items ?? []).map((item, index) => <li key={`${order.id}-${index}`}>{item.products?.name ?? 'Produk dihapus'} <span className="text-gray-500">× {item.quantity}</span></li>)}</ul><p className="mt-2 text-xs text-gray-400">Pembayaran: {order.payment_method} · {order.payment_status}</p></div><div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Ringkasan pembayaran</p><p className="mt-2 text-sm text-gray-300">Subtotal {money(order.subtotal)}</p><p className="mt-1 text-sm text-gray-300">Ongkir {money(order.shipping_fee)}</p><p className="mt-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Lokasi</p><p className="mt-1 text-sm leading-relaxed text-gray-300">{order.delivery_method === 'ambil' ? 'Ambil di toko' : order.shipping_address}</p><p className="mt-3 text-lg font-bold text-blue-200">Total {money(order.total_price)}</p></div></div><form action={updateOrderStatus} className="mt-4 flex flex-col gap-2 border-t border-white/5 pt-4 sm:flex-row sm:items-end"><input type="hidden" name="id" value={order.id} /><label className="flex flex-1 flex-col gap-1.5 text-xs font-medium text-gray-300">Ubah status<select className={fieldClass} name="status" defaultValue={order.status}>{Object.entries(statusText).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><SubmitButton>Perbarui status</SubmitButton></form></article>)}</div>}
        </>}

        {section === 'Pengaturan' && <>
          <SectionTitle eyebrow="Konfigurasi toko" title="Pengaturan" text="Atur titik toko, ongkir, dan metode pembayaran yang tersedia di checkout." />
          <StoreSettingsPanel settings={settings} paymentMethods={paymentMethods} />
        </>}

        {section === 'Manajemen Pelanggan' && <>
          <SectionTitle eyebrow="Akun & akses" title="Manajemen Pelanggan" text="Kelola akses akun pelanggan. Akun nonaktif akan dialihkan ke halaman pemberitahuan." />
          {customers.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center"><Users className="mx-auto size-8 text-gray-600" /><h3 className="mt-3 font-semibold">Belum ada pelanggan</h3><p className="mt-1 text-sm text-gray-500">Akun dengan role user akan tercantum di sini.</p></div> : <div className="grid gap-3">{customers.map((customer) => <article key={customer.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#121218] p-4 sm:flex-row sm:items-center"><div className="grid size-11 shrink-0 place-items-center rounded-full border border-violet-400/20 bg-violet-500/10 font-bold text-violet-200">P</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">Akun pelanggan</p><p className="mt-1 text-xs text-gray-600">Bergabung {date(customer.created_at)}</p></div><div className="flex items-center justify-between gap-3 sm:justify-end"><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${customer.is_active ? statusTone.selesai : statusTone.dibatalkan}`}>{customer.is_active ? 'Aktif' : 'Nonaktif'}</span><form action={setCustomerActive}><input type="hidden" name="id" value={customer.id} /><input type="hidden" name="is_active" value={String(!customer.is_active)} /><SubmitButton>{customer.is_active ? 'Nonaktifkan' : 'Aktifkan'}</SubmitButton></form></div></article>)}</div>}
        </>}
      </main>
    </div>
  </div>
}
