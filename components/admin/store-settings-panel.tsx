'use client'

import { Component, useState, useTransition, type ErrorInfo, type FormEvent, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { MapPin, Save, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { updatePaymentMethodActive, updateStoreSettings } from '@/app/admin/actions'
import { storeLatitudeDraftSchema, storeLongitudeDraftSchema, storeSettingsSchema, type StoreSettingsInput } from '@/lib/store/validation'

type StoreSettings = StoreSettingsInput & { id: boolean; updated_at: string }
type PaymentMethod = { id: string; label: string; deskripsi: string; is_active: boolean; urutan: number }
const LocationPickerMap = dynamic(() => import('@/components/storefront/location-picker-map').then((module) => module.LocationPickerMap), { ssr: false, loading: () => <div className="grid h-64 place-items-center rounded-xl bg-white/5 text-sm text-gray-400">Memuat peta…</div> })
const fieldClass = 'min-h-11 w-full rounded-xl border border-white/10 bg-[#0b0b0f] px-3.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20'
const currency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)

export function StoreSettingsPanel({ settings, paymentMethods }: { settings: StoreSettings; paymentMethods: PaymentMethod[] }) {
  return <Tabs defaultValue="store" className="flex flex-col gap-5">
    <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl border border-white/10 bg-[#121218] p-1">
      <TabsTrigger value="store" className="min-h-10 flex-1">Pengaturan toko</TabsTrigger>
      <TabsTrigger value="payments" className="min-h-10 flex-1">Metode pembayaran</TabsTrigger>
    </TabsList>
    <TabsContent value="store"><StoreSettingsForm settings={settings} /></TabsContent>
    <TabsContent value="payments"><PaymentMethodList methods={paymentMethods} /></TabsContent>
  </Tabs>
}

function StoreSettingsForm({ settings }: { settings: StoreSettings }) {
  const [busy, startTransition] = useTransition()
  const [latitudeText, setLatitudeText] = useState(String(settings.store_lat))
  const [longitudeText, setLongitudeText] = useState(String(settings.store_lng))
  const form = useForm<StoreSettingsInput>({ resolver: zodResolver(storeSettingsSchema), defaultValues: settings })
  const errors = form.formState.errors

  function submit(values: StoreSettingsInput) {
    startTransition(async () => {
      try {
        await updateStoreSettings(values)
        toast.success('Pengaturan toko diperbarui.')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Pengaturan gagal disimpan.')
      }
    })
  }

  const numberField = (name: keyof StoreSettingsInput, label: string, step = '1', min = 0) => (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-300" key={name}>{label}
      <input className={fieldClass} type="number" min={min} step={step} {...form.register(name, { valueAsNumber: true })} />
      {errors[name] && <span className="text-rose-300">{String(errors[name]?.message)}</span>}
    </label>
  )
  const commitLatitude = () => {
    const parsed = storeLatitudeDraftSchema.safeParse(latitudeText)
    if (!parsed.success) {
      form.setError('store_lat', { type: 'manual', message: parsed.error.issues[0]?.message ?? 'Latitude tidak valid.' })
      return undefined
    }
    form.clearErrors('store_lat')
    form.setValue('store_lat', parsed.data, { shouldDirty: true, shouldValidate: true })
    return parsed.data
  }

  const commitLongitude = () => {
    const parsed = storeLongitudeDraftSchema.safeParse(longitudeText)
    if (!parsed.success) {
      form.setError('store_lng', { type: 'manual', message: parsed.error.issues[0]?.message ?? 'Longitude tidak valid.' })
      return undefined
    }
    form.clearErrors('store_lng')
    form.setValue('store_lng', parsed.data, { shouldDirty: true, shouldValidate: true })
    return parsed.data
  }

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const latitude = commitLatitude()
    const longitude = commitLongitude()
    if (latitude === undefined || longitude === undefined) return
    void form.handleSubmit(submit)(event)
  }

  const setLocation = ({ latitude, longitude }: { latitude: number; longitude: number }) => {
    const safeLatitude = Number(latitude.toFixed(6))
    const safeLongitude = Number(longitude.toFixed(6))
    setLatitudeText(String(safeLatitude))
    setLongitudeText(String(safeLongitude))
    form.clearErrors(['store_lat', 'store_lng'])
    form.setValue('store_lat', safeLatitude, { shouldDirty: true, shouldValidate: true })
    form.setValue('store_lng', safeLongitude, { shouldDirty: true, shouldValidate: true })
  }

  return <form onSubmit={handleFormSubmit} className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-[#121218] p-4 sm:p-6">
    <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-500/15 text-blue-200"><Store className="size-5" /></span><div><h3 className="font-display text-lg font-bold">Identitas dan lokasi toko</h3><p className="mt-1 text-sm text-gray-400">Titik toko menjadi asal perhitungan jarak pengantaran.</p></div></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-300 sm:col-span-2">Nama toko<input className={fieldClass} maxLength={120} {...form.register('store_name')} />{errors.store_name && <span className="text-rose-300">{errors.store_name.message}</span>}</label>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-300 sm:col-span-2">Alamat toko<textarea className={`${fieldClass} min-h-20 py-3`} maxLength={500} rows={2} {...form.register('store_address')} />{errors.store_address && <span className="text-rose-300">{errors.store_address.message}</span>}</label>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-300">Latitude
        <input className={fieldClass} type="text" inputMode="decimal" value={latitudeText} aria-invalid={Boolean(errors.store_lat)} onChange={(event) => setLatitudeText(event.target.value)} onBlur={commitLatitude} />
        {errors.store_lat && <span role="alert" className="text-rose-300">{errors.store_lat.message}</span>}
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-300">Longitude
        <input className={fieldClass} type="text" inputMode="decimal" value={longitudeText} aria-invalid={Boolean(errors.store_lng)} onChange={(event) => setLongitudeText(event.target.value)} onBlur={commitLongitude} />
        {errors.store_lng && <span role="alert" className="text-rose-300">{errors.store_lng.message}</span>}
      </label>
    </div>
    <div className="overflow-hidden rounded-xl border border-white/10">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5 text-xs text-gray-300"><MapPin className="size-4 text-violet-300" />Klik peta atau geser pin untuk mengatur lokasi toko.</div>
      <LocationMapErrorBoundary>
        <LocationPickerMap latitude={form.watch('store_lat')} longitude={form.watch('store_lng')} onChange={setLocation} className="h-64" />
      </LocationMapErrorBoundary>
    </div>
    <div>
      <h4 className="mb-3 font-semibold">Aturan ongkos kirim</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        {numberField('tarif_dasar', 'Tarif dasar (Rp)', '500')}
        {numberField('tarif_per_km', 'Tarif per km (Rp)', '500')}
        {numberField('jarak_gratis_km', 'Jarak gratis (km)', '0.1')}
        {numberField('maks_jarak_km', 'Jangkauan maksimum (km)', '0.1', 0.1)}
        {numberField('ongkir_minimum', 'Ongkir minimum (Rp)', '500')}
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-300">Ambang gratis ongkir (Rp)
          <input className={fieldClass} type="number" min="0" step="500" placeholder="Nonaktifkan dengan mengosongkan" {...form.register('gratis_ongkir_min_belanja', { setValueAs: (value) => value === '' ? null : Number(value) })} />
          {errors.gratis_ongkir_min_belanja && <span className="text-rose-300">{errors.gratis_ongkir_min_belanja.message}</span>}
        </label>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-gray-500">Rumus: ongkir dasar + biaya tambahan per unit, dibulatkan ke Rp500 terdekat. Ambang gratis ongkir menghapus total ongkir jika subtotal mencapai nilai tersebut.</p>
    </div>
    <div className="flex justify-end"><Button type="submit" disabled={busy}><Save data-icon="inline-start" />{busy ? 'Menyimpan…' : 'Simpan pengaturan'}</Button></div>
  </form>
}

class LocationMapErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[admin] Store location map failed to render:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return <div role="alert" className="grid h-64 place-items-center gap-3 bg-white/[.03] p-4 text-center text-sm text-gray-300">
        <p>Peta tidak dapat dimuat. Lokasi masih bisa diatur melalui kolom Latitude dan Longitude.</p>
        <button type="button" className="min-h-10 rounded-lg border border-white/10 px-4 font-semibold hover:bg-white/5" onClick={() => this.setState({ hasError: false })}>Coba lagi</button>
      </div>
    }
    return this.props.children
  }
}

function PaymentMethodList({ methods }: { methods: PaymentMethod[] }) {
  const [items, setItems] = useState(methods)
  const [busyId, setBusyId] = useState<string | null>(null)

  function toggle(id: string, active: boolean) {
    const previous = items
    setItems((current) => current.map((method) => method.id === id ? { ...method, is_active: active } : method))
    setBusyId(id)
    void updatePaymentMethodActive(id, active).then(() => {
      toast.success(active ? 'Metode pembayaran diaktifkan.' : 'Metode pembayaran dinonaktifkan.')
    }).catch((error: unknown) => {
      setItems(previous)
      toast.error(error instanceof Error ? error.message : 'Metode pembayaran gagal diperbarui.')
    }).finally(() => setBusyId(null))
  }

  return <section className="rounded-2xl border border-white/10 bg-[#121218] p-4 sm:p-6">
    <div className="mb-4"><h3 className="font-display text-lg font-bold">Pembayaran yang tersedia</h3><p className="mt-1 text-sm text-gray-400">Hanya metode aktif yang muncul saat checkout. Minimal satu harus tetap aktif.</p></div>
    <div className="flex flex-col divide-y divide-white/5">{[...items].sort((a, b) => a.urutan - b.urutan).map((method) => <div key={method.id} className="flex items-center justify-between gap-4 py-4">
      <div><p className="font-semibold">{method.label}</p><p className="mt-1 text-xs text-gray-400">{method.deskripsi} · ID {method.id.toUpperCase()}</p></div>
      <div className="flex items-center gap-3"><span className={`text-xs ${method.is_active ? 'text-emerald-300' : 'text-gray-500'}`}>{method.is_active ? 'Aktif' : 'Nonaktif'}</span><Switch checked={method.is_active} disabled={busyId === method.id} onCheckedChange={(checked) => toggle(method.id, checked)} aria-label={`${method.is_active ? 'Nonaktifkan' : 'Aktifkan'} ${method.label}`} /></div>
    </div>)}</div>
    <p className="mt-4 border-t border-white/10 pt-4 text-xs text-gray-500">Konfigurasi Midtrans sandbox saat ini mendukung DANA, GoPay, ShopeePay, dan OVO. Aktifkan COD untuk selalu menyediakan pembayaran tunai.</p>
  </section>
}
