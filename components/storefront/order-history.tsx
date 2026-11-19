'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, Loader2, Package, RefreshCw, ShoppingBag, XCircle } from 'lucide-react'
import { PaymentStatusSync } from '@/components/storefront/payment-status-sync'
import { createClient } from '@/lib/supabase/client'

export interface OrderItem {
  quantity: number
  price: number
  products: { name: string; image_url: string | null } | null
}

export interface Order {
  id: string
  total_price: number
  subtotal: number
  shipping_fee: number
  shipping_address: string
  payment_method: string
  payment_status: string
  status: string
  delivery_method: string
  created_at: string
  order_items: OrderItem[]
}

const statusLabels: Record<string, string> = {
  pending: 'Menunggu konfirmasi', diproses: 'Sedang diproses', dikirim: 'Sedang dikirim',
  selesai: 'Selesai', dibatalkan: 'Dibatalkan',
}
const paymentLabels: Record<string, string> = {
  'belum dibayar': 'Belum dibayar', 'bayar di tempat': 'Bayar di tempat', lunas: 'Lunas',
}
const money = (amount: number) => `Rp ${new Intl.NumberFormat('id-ID').format(amount)}`

type Props = { orders: Order[]; email: string; loadError?: string }


export function OrderHistory({ orders, email, loadError }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState('Semua')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(loadError ?? null)
  const counts = useMemo(() => ({
    Semua: orders.length,
    Aktif: orders.filter((order) => ['pending', 'diproses', 'dikirim'].includes(order.status)).length,
    Selesai: orders.filter((order) => order.status === 'selesai').length,
    Dibatalkan: orders.filter((order) => order.status === 'dibatalkan').length,
  }), [orders])
  const filtered = filter === 'Semua' ? orders : orders.filter((order) => {
    if (filter === 'Aktif') return ['pending', 'diproses', 'dikirim'].includes(order.status)
    if (filter === 'Selesai') return order.status === 'selesai'
    return order.status === 'dibatalkan'
  })

  async function refreshPayment(order: Order) {
    setBusyId(order.id)
    setError(null)
    try {
      const response = await fetch(`/api/payment/status?order_id=${encodeURIComponent(order.id)}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Status pembayaran tidak dapat diperiksa.')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Status pembayaran tidak dapat diperiksa.')
    } finally {
      setBusyId(null)
    }
  }

  async function cancelOrder(order: Order) {
    const refundNote = order.payment_status === 'lunas' ? ' Pengembalian dana diproses manual oleh admin (simulasi).' : ''
    if (!window.confirm(`Batalkan pesanan ini? Stok produk akan dikembalikan.${refundNote}`)) return
    setBusyId(order.id)
    setError(null)
    try {
      const { error: cancelError } = await createClient().rpc('cancel_order', { p_order_id: order.id })
      if (cancelError) throw cancelError
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pesanan tidak dapat dibatalkan.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0b0f] px-4 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="mb-7 inline-flex min-h-10 items-center gap-2 text-sm text-gray-400 transition hover:text-white"><ArrowLeft className="size-4" />Kembali ke toko</Link>
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-violet-300">Akun kamu</p><h1 className="font-display text-3xl font-extrabold sm:text-4xl">Pesanan Saya</h1><p className="mt-1 text-sm text-gray-400">{email}</p></div>
          <Link href="/#katalog" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 text-sm font-semibold"><ShoppingBag className="size-4" />Belanja lagi</Link>
        </header>

        {error && <p role="alert" className="mb-5 flex gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200"><AlertCircle className="size-4 shrink-0" />{error}</p>}

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1" aria-label="Filter pesanan">
          {Object.entries(counts).map(([label, count]) => <button key={label} type="button" aria-pressed={filter === label} onClick={() => setFilter(label)} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition ${filter === label ? 'border-violet-400/60 bg-violet-500/15 text-violet-100' : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'}`}>{label}<span className="ml-2 text-xs opacity-70">{count}</span></button>)}
        </div>

        {!filtered.length ? <section className="rounded-2xl border border-white/10 bg-[#121218] p-10 text-center sm:p-14"><Package className="mx-auto size-10 text-gray-500" /><h2 className="mt-4 font-display text-xl font-bold">{orders.length ? 'Tidak ada pesanan di kategori ini' : 'Belum ada pesanan'}</h2><p className="mt-2 text-sm text-gray-400">{orders.length ? 'Pilih filter lain untuk melihat pesanan.' : 'Pesanan yang kamu buat akan muncul di sini.'}</p>{!orders.length && <Link href="/#katalog" className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold">Jelajahi katalog</Link>}</section> : <div className="space-y-4">
          {filtered.map((order) => {
            const canCancel = ['pending', 'diproses'].includes(order.status)
            const pendingPayment = order.payment_status === 'belum dibayar' && order.payment_method !== 'COD'
            const statusClass = order.status === 'selesai' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : order.status === 'dibatalkan' ? 'border-rose-400/20 bg-rose-400/10 text-rose-200' : order.status === 'dikirim' ? 'border-blue-400/20 bg-blue-400/10 text-blue-200' : 'border-amber-400/20 bg-amber-400/10 text-amber-200'
            return <article key={order.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#121218]">
              {pendingPayment && <PaymentStatusSync orderId={order.id} status={order.status} paymentStatus={order.payment_status} />}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
                <div><p className="text-[11px] uppercase tracking-wider text-gray-500">Pesanan · {new Date(order.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p><p className="mt-1 font-mono text-xs text-gray-400">#{order.id.slice(0, 8).toUpperCase()}</p></div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass}`}><span className="size-1.5 rounded-full bg-current" />{statusLabels[order.status] ?? order.status}</span>
              </div>
              <div className="space-y-3 px-4 py-4 sm:px-5">
                {order.order_items.map((item, index) => <div key={`${order.id}-${index}`} className="flex items-center gap-3">
                  <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/5">{item.products?.image_url ? <img src={item.products.image_url} alt="" className="size-full object-cover" /> : <Package className="size-5 text-gray-500" />}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.products?.name ?? 'Produk'}</p><p className="text-xs text-gray-400">{item.quantity} × {money(item.price)}</p></div><span className="text-sm font-medium">{money(item.quantity * item.price)}</span>
                </div>)}
                <div className="space-y-1 border-t border-white/10 pt-3 text-xs text-gray-400">
                  <div className="flex justify-between"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
                  <div className="flex justify-between"><span>Ongkos kirim</span><span>{money(order.shipping_fee)}</span></div>
                  <div className="flex justify-between"><span>Lokasi</span><span className="max-w-[65%] text-right">{order.delivery_method === 'ambil' ? 'Ambil di toko' : order.shipping_address}</span></div>
                  <div className="flex justify-between"><span>Metode pembayaran</span><span>{order.payment_method}</span></div>
                  <div className="flex justify-between"><span>Status pembayaran</span><span>{paymentLabels[order.payment_status] ?? order.payment_status}</span></div>
                  <div className="flex justify-between border-t border-white/10 pt-2 text-sm font-bold text-white"><span>Total</span><span className="text-blue-300">{money(order.total_price)}</span></div>
                </div>
                {order.payment_status === 'lunas' && order.status !== 'selesai' && order.status !== 'dibatalkan' && <p className="rounded-lg border border-amber-400/15 bg-amber-400/5 px-3 py-2 text-xs leading-relaxed text-amber-100">Jika pesanan ini dibatalkan, pengembalian dana diproses manual oleh admin (simulasi).</p>}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
                  <p className="text-xs text-gray-400">{order.delivery_method === 'ambil' ? 'Ambil di toko' : 'Antar'} · {paymentLabels[order.payment_status] ?? order.payment_status}</p>
                  <div className="flex flex-wrap gap-2">
                    {pendingPayment && <Link href={`/pesanan/konfirmasi/${order.id}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-blue-400/20 px-3 text-xs font-semibold text-blue-100 hover:bg-blue-500/10">Lanjutkan Pembayaran</Link>}
                    {pendingPayment && <button type="button" disabled={busyId === order.id} onClick={() => refreshPayment(order)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-gray-200 hover:bg-white/5 disabled:opacity-50"><RefreshCw className={`size-3.5 ${busyId === order.id ? 'animate-spin' : ''}`} />Periksa status</button>}
                    {canCancel && <button type="button" disabled={busyId === order.id} onClick={() => cancelOrder(order)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-400/20 px-3 text-xs font-semibold text-rose-200 hover:bg-rose-500/10 disabled:opacity-50">{busyId === order.id ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}Batalkan Pesanan</button>}
                    {!pendingPayment && <Link href={`/pesanan/konfirmasi/${order.id}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white/5 px-3 text-xs font-semibold text-gray-200 hover:bg-white/10">Detail</Link>}
                  </div>
                </div>
              </div>
            </article>
          })}
        </div>}
      </div>
    </main>
  )
}
