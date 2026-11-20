'use client'

import { useId, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Loader2, MapPin, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Product = { id: string; name: string; price: number; promoPrice?: number | null; stock: number; imageUrl?: string | null }
type CheckoutItem = { product: Product; quantity: number }
type Props = { product: Product; open: boolean; onClose: () => void; cartItems?: CheckoutItem[]; onOrderCreated?: () => void }
type PaymentMethod = { id: string; label: string; deskripsi: string; urutan: number }
type Coordinates = { latitude: number; longitude: number }
type ShippingQuote = { distance_km: number; shipping_fee: number; is_deliverable: boolean; quote_message: string | null }
type SnapResult = { order?: { order_id: string; total_price: number; payment_method: string }; snap_token?: string | null; error?: string }

declare global {
  interface Window {
    snap?: { pay: (token: string, options: { onSuccess: () => void; onPending: () => void; onError: () => void; onClose: () => void }) => void }
  }
}

const LocationPickerMap = dynamic(() => import('@/components/storefront/location-picker-map').then((module) => module.LocationPickerMap), { ssr: false, loading: () => <div className="grid h-56 place-items-center bg-white/5 text-sm text-gray-400">Memuat peta…</div> })
const money = (amount: number) => `Rp ${new Intl.NumberFormat('id-ID').format(amount)}`
const sellingPrice = (product: Product) => product.promoPrice ?? product.price
const paymentTone: Record<string, string> = {
  cod: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
  dana: 'border-blue-300/20 bg-blue-300/10 text-blue-200',
  gopay: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
  shopeepay: 'border-orange-300/20 bg-orange-300/10 text-orange-200',
  ovo: 'border-violet-300/20 bg-violet-300/10 text-violet-200',
}
const defaultMapCenter = { latitude: -7.2575, longitude: 112.7521 }

export function CheckoutDialog({ product, open, onClose, cartItems, onOrderCreated }: Props) {
  const router = useRouter()
  const addressId = useId()
  const [quantity, setQuantity] = useState(1)
  const [deliveryMethod, setDeliveryMethod] = useState<'antar' | 'ambil'>('antar')
  const [address, setAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const orderItems = useMemo(() => cartItems ?? [{ product, quantity }], [cartItems, product, quantity])
  const subtotal = orderItems.reduce((sum, item) => sum + sellingPrice(item.product) * item.quantity, 0)
  const itemsForApi = orderItems.map(({ product: item, quantity: amount }) => ({ product_id: item.id, quantity: amount }))
  const { data: paymentMethods, error: methodsError, isLoading: methodsLoading } = useSWR<PaymentMethod[]>('checkout-payment-methods', async () => {
    const supabase = createClient()
    const { data, error } = await supabase.from('payment_methods_public').select('id, label, deskripsi, urutan').order('urutan')
    if (error) throw new Error('Metode pembayaran belum dapat dimuat.')
    return data ?? []
  })
  const quoteKey = deliveryMethod === 'antar' && coordinates
    ? `shipping:${coordinates.latitude}:${coordinates.longitude}:${JSON.stringify(itemsForApi)}`
    : null
  const { data: remoteQuote, error: quoteError, isLoading: quoteLoading } = useSWR<ShippingQuote>(quoteKey, async () => {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('quote_shipping', {
      p_items: itemsForApi,
      p_delivery_method: 'antar',
      p_latitude: coordinates!.latitude,
      p_longitude: coordinates!.longitude,
    })
    if (error) throw new Error(error.message)
    return data?.[0] as ShippingQuote
  })
  const selectedMethod = paymentMethods?.find((method) => method.id === paymentMethod) ?? paymentMethods?.[0]
  const shippingFee = deliveryMethod === 'ambil' ? 0 : remoteQuote?.shipping_fee ?? 0
  const total = subtotal + Number(shippingFee)
  const isDeliverable = deliveryMethod === 'ambil' || Boolean(remoteQuote?.is_deliverable)
  const canSubmit = !loading && !methodsLoading && Boolean(selectedMethod) &&
    orderItems.every((item) => item.product.stock >= item.quantity) &&
    (deliveryMethod === 'ambil' || (address.trim().length >= 8 && coordinates !== null && remoteQuote?.is_deliverable === true && !quoteLoading))

  if (!open) return null

  function useLocation() {
    setMessage(null)
    if (!navigator.geolocation) {
      setMessage('Lokasi otomatis tidak didukung browser ini. Pilih titik pengiriman langsung di peta.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords: point }) => setCoordinates({ latitude: point.latitude, longitude: point.longitude }),
      () => setMessage('Lokasi tidak tersedia. Izinkan akses lokasi atau pilih titik langsung di peta.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  }

  async function submitOrder() {
    if (!selectedMethod) {
      setMessage('Belum ada metode pembayaran yang aktif. Hubungi pengelola toko.')
      return
    }
    if (deliveryMethod === 'antar' && address.trim().length < 8) {
      setMessage('Masukkan alamat pengiriman yang lengkap.')
      return
    }
    if (deliveryMethod === 'antar' && (!coordinates || !remoteQuote?.is_deliverable)) {
      setMessage(remoteQuote?.quote_message || 'Pilih lokasi pengiriman yang masih dalam jangkauan toko.')
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsForApi,
          delivery_method: deliveryMethod,
          shipping_address: deliveryMethod === 'antar' ? address.trim() : 'Ambil di toko',
          latitude: deliveryMethod === 'antar' ? coordinates?.latitude : null,
          longitude: deliveryMethod === 'antar' ? coordinates?.longitude : null,
          payment_method: selectedMethod.id,
        }),
      })
      const result: SnapResult = await response.json()
      if (!response.ok || !result.order) throw new Error(result.error || 'Pesanan tidak dapat dibuat.')
      onOrderCreated?.()

      if (selectedMethod.id !== 'cod') {
        if (!result.snap_token || !window.snap) {
          router.push(`/pesanan/konfirmasi/${result.order.order_id}`)
          return
        }
        const orderId = result.order.order_id
        window.snap.pay(result.snap_token, {
          onSuccess: () => { setSuccess(true); router.push(`/pesanan/konfirmasi/${orderId}`); router.refresh() },
          onPending: () => router.push(`/pesanan/konfirmasi/${orderId}`),
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
          <div><p className="text-xs font-semibold uppercase tracking-wider text-violet-300">Checkout aman</p><h2 id="checkout-title" className="mt-1 font-display text-xl font-bold text-white">{cartItems ? `${cartItems.length} produk di keranjang` : product.name}</h2><span className="mt-2 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-semibold text-amber-200">Mode Sandbox · bukan uang asli</span></div>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-xl text-gray-400 hover:bg-white/10 hover:text-white" aria-label="Tutup checkout"><X className="size-5" /></button>
        </header>

        <div className="flex flex-col gap-5 p-5 sm:p-6">
          {cartItems ? <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-white/[.03] p-3">{cartItems.map(({ product: item, quantity: amount }) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[.03] p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{item.name}</p><p className="mt-1 text-xs text-gray-400">{amount} × {money(sellingPrice(item))}</p>{item.promoPrice != null && <del className="text-[11px] text-gray-500">{money(item.price)}</del>}</div><span className="shrink-0 text-sm font-semibold text-blue-300">{money(sellingPrice(item) * amount)}</span></div>)}</div> : <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="flex min-w-0 items-center gap-3">{product.imageUrl ? <img src={product.imageUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" /> : <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-xs font-bold text-violet-200">AM</div>}<div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{product.name}</p><p className="mt-1 text-sm text-blue-300">{money(sellingPrice(product))} / item</p>{product.promoPrice != null && <del className="text-xs text-gray-500">{money(product.price)}</del>}</div></div><div className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 p-1"><button type="button" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="grid size-11 place-items-center rounded-lg text-white hover:bg-white/10 disabled:opacity-40" aria-label="Kurangi jumlah">−</button><span className="w-5 text-center text-sm font-semibold" aria-live="polite">{quantity}</span><button type="button" disabled={quantity >= product.stock} onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))} className="grid size-11 place-items-center rounded-lg text-white hover:bg-white/10 disabled:opacity-40" aria-label="Tambah jumlah">+</button></div></div>}

          <fieldset><legend className="mb-2 text-sm font-semibold text-white">Cara menerima pesanan</legend><div className="grid grid-cols-2 gap-2">{(['antar', 'ambil'] as const).map((method) => <button key={method} type="button" onClick={() => setDeliveryMethod(method)} aria-pressed={deliveryMethod === method} className={`min-h-12 rounded-xl border px-3 text-sm font-semibold transition ${deliveryMethod === method ? 'border-violet-400 bg-violet-500/15 text-violet-100' : 'border-white/10 text-gray-400 hover:border-white/25'}`}>{method === 'antar' ? 'Antar ke alamat' : 'Ambil di toko'}</button>)}</div></fieldset>

          {deliveryMethod === 'antar' && <div className="flex flex-col gap-2.5">
            <label htmlFor={addressId} className="text-sm font-semibold text-white">Alamat pengiriman</label>
            <textarea id={addressId} value={address} onChange={(event) => setAddress(event.target.value)} rows={3} maxLength={500} placeholder="Nama jalan, nomor rumah, kelurahan, kecamatan" className="w-full resize-y rounded-xl border border-white/10 bg-[#17171f] px-3.5 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-violet-400" />
            <div className="flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={useLocation} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-medium text-gray-300 hover:bg-white/5"><MapPin className="size-3.5" />{coordinates ? 'Perbarui lokasi saya' : 'Gunakan lokasi saya'}</button><span className="text-[11px] text-gray-400">{coordinates ? `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}` : 'Klik peta untuk memilih titik'}</span></div>
            <div className="overflow-hidden rounded-xl border border-white/10"><LocationPickerMap latitude={coordinates?.latitude ?? defaultMapCenter.latitude} longitude={coordinates?.longitude ?? defaultMapCenter.longitude} showMarker={coordinates !== null} onChange={setCoordinates} className="h-56" /></div>
            <p className="text-xs text-gray-400">Geser pin atau klik peta untuk menentukan lokasi. Jarak dan ongkir dihitung dari titik toko.</p>
            {quoteLoading && coordinates && <p role="status" className="text-xs text-blue-200">Menghitung jarak dan ongkir…</p>}
            {quoteError && <p role="alert" className="text-xs text-rose-300">{quoteError.message}</p>}
            {remoteQuote && <p role={remoteQuote.is_deliverable ? 'status' : 'alert'} className={`rounded-lg p-2.5 text-xs ${remoteQuote.is_deliverable ? 'bg-emerald-500/10 text-emerald-200' : 'bg-rose-500/10 text-rose-200'}`}>{remoteQuote.is_deliverable ? `${remoteQuote.distance_km.toFixed(1)} km dari toko` : remoteQuote.quote_message || 'Di luar jangkauan antar'}{remoteQuote.is_deliverable && ` · Ongkir ${money(Number(remoteQuote.shipping_fee))}`}</p>}
          </div>}

          <fieldset><legend className="mb-2 text-sm font-semibold text-white">Metode pembayaran</legend><div className="flex flex-col gap-2">
            {methodsLoading && <p className="rounded-xl border border-white/10 p-3 text-xs text-gray-400">Memuat metode pembayaran…</p>}
            {methodsError && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-200">Metode pembayaran belum dapat dimuat. Coba buka kembali checkout.</p>}
            {(paymentMethods ?? []).map((method) => <label key={method.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 transition ${selectedMethod?.id === method.id ? 'border-blue-400/70 bg-blue-500/10' : 'border-white/10 hover:border-white/25'}`}><input type="radio" name="payment-method" value={method.id} checked={selectedMethod?.id === method.id} onChange={() => setPaymentMethod(method.id)} className="size-4 accent-blue-400" /><span className={`grid min-h-8 min-w-16 place-items-center rounded-lg border px-2 text-[10px] font-bold ${paymentTone[method.id] ?? 'border-white/10 bg-white/5 text-gray-200'}`}>{method.id === 'cod' ? 'COD' : method.id.toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-white">{method.label}</span><span className="block text-[11px] text-gray-400">{method.deskripsi}</span></span></label>)}
            {!methodsLoading && !methodsError && paymentMethods?.length === 0 && <p role="alert" className="text-xs text-rose-300">Belum ada metode pembayaran aktif.</p>}
          </div></fieldset>

          <div className="flex flex-col gap-2 border-t border-white/10 pt-4 text-sm"><div className="flex justify-between text-gray-400"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="flex justify-between text-gray-400"><span>Ongkos kirim</span><span>{deliveryMethod === 'antar' && !coordinates ? 'Pilih lokasi' : money(Number(shippingFee))}</span></div><div className="flex justify-between pt-1 font-bold text-white"><span>Total estimasi</span><span className="text-blue-300">{money(total)}</span></div><p className="text-[11px] leading-relaxed text-gray-500">Total akhir dihitung kembali oleh database sebelum stok dan pesanan disimpan.</p></div>
          {message && <p role="alert" className="flex gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200"><AlertCircle className="mt-0.5 size-4 shrink-0" />{message}</p>}
          {success && <p role="status" className="flex gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200"><CheckCircle2 className="size-4 shrink-0" />Pesanan dibuat. Membuka konfirmasi…</p>}
          {!isDeliverable && remoteQuote?.quote_message && <p role="alert" className="text-xs text-rose-200">{remoteQuote.quote_message}</p>}
          <button type="button" onClick={submitOrder} disabled={!canSubmit} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 font-bold text-white shadow-lg shadow-violet-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">{loading ? <Loader2 className="size-4 animate-spin" /> : null}{loading ? 'Memproses pesanan…' : selectedMethod?.id === 'cod' ? 'Buat Pesanan' : 'Lanjutkan ke Pembayaran'}</button>
        </div>
      </section>
    </div>
  )
}
