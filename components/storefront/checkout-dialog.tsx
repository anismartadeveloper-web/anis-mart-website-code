'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Loader2, MapPin, X } from 'lucide-react'
import { shippingQuote } from '@/lib/store/config'

type Product = {
  id: string
  name: string
  price: number
  stock: number
  imageUrl?: string | null
}

type Props = {
  product: Product
  open: boolean
  onClose: () => void
}

type SnapResult = {
  order?: { order_id: string; total_price: number; payment_method: string }
  snap_token?: string | null
  error?: string
}

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options: {
        onSuccess: () => void
        onPending: () => void
        onError: () => void
        onClose: () => void
      }) => void
    }
  }
}

const money = (amount: number) => `Rp ${new Intl.NumberFormat('id-ID').format(amount)}`
const paymentOptions = [
  { value: 'COD', label: 'Bayar di tempat', detail: 'Tunai saat pesanan diterima', tone: 'border-amber-300/20 bg-amber-300/10 text-amber-200' },
  { value: 'DANA', label: 'DANA', detail: 'Dompet digital', tone: 'border-blue-300/20 bg-blue-300/10 text-blue-200' },
  { value: 'GoPay', label: 'GoPay', detail: 'Dompet digital', tone: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' },
  { value: 'ShopeePay', label: 'ShopeePay', detail: 'Dompet digital', tone: 'border-orange-300/20 bg-orange-300/10 text-orange-200' },
  { value: 'OVO', label: 'OVO', detail: 'Dompet digital', tone: 'border-violet-300/20 bg-violet-300/10 text-violet-200' },
]

export function CheckoutDialog({ product, open, onClose }: Props) {
  const router = useRouter()
  const addressId = useId()
  const [quantity, setQuantity] = useState(1)
  const [deliveryMethod, setDeliveryMethod] = useState<'antar' | 'ambil'>('antar')
  const [address, setAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('COD')
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const quote = shippingQuote(deliveryMethod, coordinates?.latitude ?? null, coordinates?.longitude ?? null)
  const total = product.price * quantity + quote.fee

  if (!open) return null

  async function useLocation() {
    setMessage(null)
    if (!navigator.geolocation) {
      setMessage('Browser ini belum mendukung lokasi. Masukkan alamat pengiriman manual.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setCoordinates({ latitude: coords.latitude, longitude: coords.longitude }),
      () => setMessage('Lokasi tidak tersedia. Kamu tetap bisa memesan dengan alamat manual.'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }

  async function submitOrder() {
    if (deliveryMethod === 'antar' && address.trim().length < 8) {
      setMessage('Masukkan alamat pengiriman yang lengkap.')
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          quantity,
          delivery_method: deliveryMethod,
          shipping_address: deliveryMethod === 'antar' ? address.trim() : 'Ambil di toko',
          latitude: deliveryMethod === 'antar' ? coordinates?.latitude ?? null : null,
          longitude: deliveryMethod === 'antar' ? coordinates?.longitude ?? null : null,
          payment_method: paymentMethod,
          shipping_fee: quote.fee,
        }),
      })
      const result: SnapResult = await response.json()
      if (!response.ok || !result.order) throw new Error(result.error || 'Pesanan tidak dapat dibuat.')

      if (paymentMethod !== 'COD') {
        if (!result.snap_token || !window.snap) {
          router.push(`/pesanan/konfirmasi/${result.order.order_id}`)
          return
        }
        const orderId = result.order.order_id
        window.snap.pay(result.snap_token, {
          onSuccess: () => {
            setSuccess(true)
            router.push(`/pesanan/konfirmasi/${orderId}`)
            router.refresh()
          },
          onPending: () => {
            router.push(`/pesanan/konfirmasi/${orderId}`)
          },
          onError: () => setMessage('Pembayaran belum berhasil. Pesanan bisa dibayar dari halaman Pesanan Saya.'),
          onClose: () => setMessage('Pembayaran belum selesai. Kamu bisa melanjutkannya dari halaman Pesanan Saya.'),
        })
      } else {
        setSuccess(true)
        router.push(`/pesanan/konfirmasi/${result.order.order_id}`)
        router.refresh()
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Terjadi kesalahan saat membuat pesanan.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="checkout-title" className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#101016] shadow-2xl sm:rounded-3xl">
        <header className="flex items-start justify-between border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">Checkout aman</p>
            <h2 id="checkout-title" className="mt-1 font-display text-xl font-bold text-white">{product.name}</h2>
            <span className="mt-2 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-semibold text-amber-200">Mode Sandbox · bukan uang asli</span>
          </div>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-xl text-gray-400 hover:bg-white/10 hover:text-white" aria-label="Tutup checkout"><X className="size-5" /></button>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <div className="flex min-w-0 items-center gap-3">
              {product.imageUrl ? <img src={product.imageUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" /> : <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-xs font-bold text-violet-200">AM</div>}
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{product.name}</p><p className="mt-1 text-sm text-blue-300">{money(product.price)} / item</p></div>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 p-1">
              <button type="button" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="grid size-11 place-items-center rounded-lg text-white hover:bg-white/10 disabled:opacity-40" aria-label="Kurangi jumlah">−</button>
              <span className="w-5 text-center text-sm font-semibold" aria-live="polite">{quantity}</span>
              <button type="button" disabled={quantity >= product.stock} onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))} className="grid size-11 place-items-center rounded-lg text-white hover:bg-white/10 disabled:opacity-40" aria-label="Tambah jumlah">+</button>
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-white">Cara menerima pesanan</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['antar', 'ambil'] as const).map((method) => <button key={method} type="button" onClick={() => setDeliveryMethod(method)} aria-pressed={deliveryMethod === method} className={`min-h-12 rounded-xl border px-3 text-sm font-semibold transition ${deliveryMethod === method ? 'border-violet-400 bg-violet-500/15 text-violet-100' : 'border-white/10 text-gray-400 hover:border-white/25'}`}>{method === 'antar' ? 'Antar ke alamat' : 'Ambil di toko'}</button>)}
            </div>
          </fieldset>

          {deliveryMethod === 'antar' && <div className="space-y-2">
            <label htmlFor={addressId} className="text-sm font-semibold text-white">Alamat pengiriman</label>
            <textarea id={addressId} value={address} onChange={(event) => setAddress(event.target.value)} rows={3} maxLength={500} placeholder="Nama jalan, nomor rumah, kelurahan, kecamatan" className="w-full resize-y rounded-xl border border-white/10 bg-[#17171f] px-3.5 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-violet-400" />
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={useLocation} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-medium text-gray-300 hover:bg-white/5"><MapPin className="size-3.5" />{coordinates ? 'Lokasi terpilih' : 'Gunakan lokasi saya'}</button>
              <span className="text-[11px] text-gray-500">{quote.distanceKm === null ? 'Ongkir estimasi' : `${quote.distanceKm.toFixed(1)} km`}</span>
            </div>
          </div>}

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-white">Metode pembayaran</legend>
            <div className="space-y-2">
              {paymentOptions.map((option) => <label key={option.value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 transition ${paymentMethod === option.value ? 'border-blue-400/70 bg-blue-500/10' : 'border-white/10 hover:border-white/25'}`}>
                <input type="radio" name="payment-method" value={option.value} checked={paymentMethod === option.value} onChange={() => setPaymentMethod(option.value)} className="size-4 accent-blue-400" />
                <span className={`grid min-h-8 min-w-16 place-items-center rounded-lg border px-2 text-[10px] font-bold ${option.tone}`}>{option.value === 'COD' ? 'COD' : option.value}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-white">{option.label}</span><span className="block text-[11px] text-gray-400">{option.detail}</span></span>
              </label>)}
            </div>
          </fieldset>

          <div className="space-y-2 border-t border-white/10 pt-4 text-sm">
            <div className="flex justify-between text-gray-400"><span>Subtotal</span><span>{money(product.price * quantity)}</span></div>
            <div className="flex justify-between text-gray-400"><span>Ongkos kirim</span><span>{money(quote.fee)}</span></div>
            <div className="flex justify-between pt-1 font-bold text-white"><span>Total</span><span className="text-blue-300">{money(total)}</span></div>
            <p className="text-[11px] leading-relaxed text-gray-500">Total akhir dihitung kembali di server sebelum pesanan disimpan.</p>
          </div>

          {message && <p role="alert" className="flex gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200"><AlertCircle className="mt-0.5 size-4 shrink-0" />{message}</p>}
          {success && <p role="status" className="flex gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200"><CheckCircle2 className="size-4 shrink-0" />Pesanan dibuat. Membuka konfirmasi…</p>}
          <button type="button" onClick={submitOrder} disabled={loading || product.stock < 1} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 font-bold text-white shadow-lg shadow-violet-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}{loading ? 'Memproses pesanan…' : paymentMethod === 'COD' ? 'Buat Pesanan' : 'Lanjutkan ke Pembayaran'}
          </button>
        </div>
      </section>
    </div>
  )
}
