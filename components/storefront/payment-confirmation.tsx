'use client'

import Script from 'next/script'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, Loader2, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options: { onSuccess: () => void; onPending: () => void; onError: () => void; onClose: () => void }) => void
    }
  }
}

type Props = {
  order: {
    id: string
    status: string
    payment_status: string
    payment_method: string
    total_price: number
    delivery_method: string
    shipping_address: string
    created_at: string
    snap_token: string | null
    order_items: Array<{ quantity: number; price: number; products: { name: string } | null }>
  }
}

const money = (amount: number) => `Rp ${new Intl.NumberFormat('id-ID').format(amount)}`

export function PaymentConfirmation({ order: initialOrder }: Props) {
  const router = useRouter()
  const [order, setOrder] = useState(initialOrder)
  const [snapReady, setSnapReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function refreshStatus() {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/payment/status?order_id=${encodeURIComponent(order.id)}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Status pembayaran tidak dapat diperiksa.')
      if (result.order) setOrder((current) => ({ ...current, ...result.order }))
      router.refresh()
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Status pembayaran tidak dapat diperiksa.')
    } finally {
      setBusy(false)
    }
  }

  function pay() {
    if (!order.snap_token || !window.snap) {
      setMessage('Pembayaran belum siap. Coba muat ulang halaman.')
      return
    }
    setBusy(true)
    window.snap.pay(order.snap_token, {
      onSuccess: () => { void refreshStatus().then(() => router.push('/pesanan-saya')) },
      onPending: () => { setBusy(false); setMessage('Pembayaran menunggu konfirmasi. Status akan diperbarui otomatis dari Midtrans.') },
      onError: () => { setBusy(false); setMessage('Pembayaran belum berhasil. Kamu dapat mencoba lagi.') },
      onClose: () => setBusy(false),
    })
  }

  const canceled = order.status === 'dibatalkan'
  const paid = order.payment_status === 'lunas'

  return <main className="min-h-screen bg-[#0b0b0f] px-4 py-8 text-white sm:px-6 sm:py-12">
    {order.payment_method !== 'COD' && <Script src="https://app.sandbox.midtrans.com/snap/snap.js" data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY} onReady={() => setSnapReady(true)} />}
    <div className="mx-auto max-w-2xl">
      <Link href="/pesanan-saya" className="mb-7 inline-flex min-h-10 items-center gap-2 text-sm text-gray-400 hover:text-white"><ArrowLeft className="size-4" />Pesanan saya</Link>
      <article className="overflow-hidden rounded-3xl border border-white/10 bg-[#121218]">
        <header className="border-b border-white/10 p-5 sm:p-7"><span className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Anis Mart · Checkout</span><h1 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">Konfirmasi pesanan</h1><p className="mt-2 break-all font-mono text-xs text-gray-500">#{order.id}</p></header>
        <div className="space-y-5 p-5 sm:p-7">
          <div className={`flex items-start gap-3 rounded-2xl border p-4 ${canceled ? 'border-rose-400/20 bg-rose-500/10' : paid ? 'border-emerald-400/20 bg-emerald-500/10' : 'border-amber-400/20 bg-amber-500/10'}`}>
            {canceled ? <AlertCircle className="mt-0.5 size-5 text-rose-300" /> : paid ? <CheckCircle2 className="mt-0.5 size-5 text-emerald-300" /> : <Clock3 className="mt-0.5 size-5 text-amber-300" />}
            <div><p className="font-semibold">{canceled ? 'Pesanan dibatalkan' : paid ? 'Pembayaran berhasil' : order.payment_method === 'COD' ? 'Pesanan menunggu diproses' : 'Menunggu pembayaran'}</p><p className="mt-1 text-sm text-gray-300">{canceled ? 'Stok telah dikembalikan ke katalog.' : order.payment_method === 'COD' ? 'Pembayaran dilakukan saat pesanan diterima.' : paid ? 'Terima kasih, pembayaran sudah kami terima.' : 'Selesaikan pembayaran melalui Midtrans untuk melanjutkan pesanan.'}</p></div>
          </div>
          <section aria-label="Ringkasan pesanan" className="space-y-3">
            {order.order_items.map((item, index) => <div key={`${order.id}-${index}`} className="flex justify-between gap-4 text-sm"><span className="text-gray-300">{item.products?.name ?? 'Produk'} × {item.quantity}</span><span>{money(item.price * item.quantity)}</span></div>)}
            <div className="flex justify-between border-t border-white/10 pt-3 text-sm"><span className="text-gray-400">Metode pembayaran</span><span>{order.payment_method}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">Pengiriman</span><span>{order.delivery_method === 'ambil' ? 'Ambil di toko' : 'Antar ke alamat'}</span></div>
            {order.delivery_method === 'antar' && <p className="rounded-xl bg-white/[.03] p-3 text-sm leading-relaxed text-gray-300">{order.shipping_address}</p>}
            <div className="flex justify-between border-t border-white/10 pt-4 font-bold"><span>Total</span><span className="text-blue-300">{money(order.total_price)}</span></div>
          </section>
          {message && <p role="status" className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3 text-sm text-blue-100">{message}</p>}
          {!canceled && order.payment_method !== 'COD' && !paid && order.snap_token && <button type="button" onClick={pay} disabled={busy || !snapReady} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 font-bold disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : null}{snapReady ? 'Lanjutkan pembayaran' : 'Memuat pembayaran…'}</button>}
          {!canceled && order.payment_method !== 'COD' && !paid && <button type="button" onClick={refreshStatus} disabled={busy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 text-sm font-semibold text-gray-200 hover:bg-white/5 disabled:opacity-50"><RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} />Periksa status pembayaran</button>}
          <Link href="/pesanan-saya" className="flex min-h-11 w-full items-center justify-center rounded-xl border border-white/10 text-sm font-semibold text-gray-200 hover:bg-white/5">Lihat semua pesanan</Link>
        </div>
      </article>
    </div>
  </main>
}
