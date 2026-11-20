'use client'

import { Component, useState, useTransition, type ErrorInfo, type ReactNode } from 'react'
import Image from 'next/image'
import imageCompression from 'browser-image-compression'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { ImagePlus, PackagePlus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { createProduct, deleteProduct, updateProduct } from '@/app/admin/actions'
import { createClient } from '@/lib/supabase/client'
import { productSchema, type ProductInput } from '@/lib/store/validation'

type Product = ProductInput & { id: string; created_at: string }
const unitOptions = ['g', 'kg', 'ml', 'L', 'pcs', 'pack', 'botol', 'sachet', 'dus'] as const
const skuPrefix = (category: ProductInput['category']) => category === 'Snack' ? 'NS' : 'MN'
function nextSku(existingSkus: string[], category: ProductInput['category'], currentSku?: string) {
  const prefix = skuPrefix(category)
  const currentNumber = existingSkus.reduce((highest, sku) => {
    if (sku === currentSku) return highest
    const match = sku.match(new RegExp(`^${prefix}-(\\d+)$`, 'i'))
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
  return `${prefix}-${String(currentNumber + 1).padStart(3, '0')}`
}
const fieldClass = 'min-h-11 w-full rounded-xl border border-white/10 bg-[#0b0b0f] px-3.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20'
const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)

function ProductForm({ product, existingSkus, onSaved, onCancel }: { product?: Product; existingSkus: string[]; onSaved?: () => void; onCancel?: () => void }) {
  const [busy, startTransition] = useTransition()
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState(product?.image_url ?? null)
  const [skuEditable, setSkuEditable] = useState(!product)
  const [skuMode, setSkuMode] = useState<'automatic' | 'manual'>('automatic')
  const [skuValue, setSkuValue] = useState(product?.sku ?? nextSku(existingSkus, 'Snack'))
  const [skuError, setSkuError] = useState<string | null>(null)
  const [unitIsOther, setUnitIsOther] = useState(Boolean(product?.unit_label && !unitOptions.includes(product.unit_label as typeof unitOptions[number])))
  const form = useForm<z.input<typeof productSchema>, unknown, ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: product ?? {
      sku: skuValue, unit_size: null, unit_label: null, unit_note: null,
      name: '', category: 'Snack', price: 10000, promo_price: null, stock: 0,
      extra_shipping_fee: 0, is_active: true, image_url: null, image_path: null, description: null,
    },
  })
  const errors = form.formState.errors

  function updateAutomaticSku(category: ProductInput['category']) {
    if (skuMode !== 'automatic' || (product && !skuEditable)) return
    const next = nextSku(existingSkus, category, product?.sku)
    setSkuValue(next)
    form.setValue('sku', next, { shouldDirty: true, shouldValidate: true })
    setSkuError(null)
  }

  async function checkSkuUnique(value: string) {
    const normalized = value.trim().toUpperCase()
    setSkuValue(normalized)
    form.setValue('sku', normalized, { shouldDirty: true, shouldValidate: true })
    if (!/^[A-Z]{2,4}-\d{3,}$/.test(normalized)) {
      setSkuError(null)
      return
    }
    const { data, error } = await createClient().from('products').select('id').ilike('sku', normalized).neq('id', product?.id ?? '').maybeSingle()
    setSkuError(error ? 'SKU belum dapat diperiksa. Coba lagi.' : data ? 'SKU sudah dipakai.' : null)
  }

  async function chooseImage(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) {
      toast.error('Pilih gambar JPG, PNG, atau WebP dengan ukuran di bawah 20 MB.')
      return
    }
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 1.8, maxWidthOrHeight: 1600, useWebWorker: true, fileType: 'image/webp' })
      if (compressed.size > 2 * 1024 * 1024) throw new Error('Gambar tetap lebih dari 2 MB setelah dikompresi.')
      const webp = new File([compressed], `${crypto.randomUUID()}.webp`, { type: 'image/webp' })
      setImageFile(webp)
      setPreview(URL.createObjectURL(webp))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gambar tidak dapat diproses.')
    }
  }

  function submit(values: ProductInput) {
    startTransition(async () => {
      let uploadedPath: string | null = null
      try {
        let imageUrl = values.image_url
        let imagePath = values.image_path
        if (imageFile) {
          const supabase = createClient()
          uploadedPath = `${values.category.toLowerCase()}/${imageFile.name}`
          const { error: uploadError } = await supabase.storage.from('product-images').upload(uploadedPath, imageFile, { contentType: 'image/webp', upsert: true })
          if (uploadError) throw new Error(uploadError.message)
          imageUrl = supabase.storage.from('product-images').getPublicUrl(uploadedPath).data.publicUrl
          imagePath = uploadedPath
        }
        const nextValues = { ...values, image_url: imageUrl, image_path: imagePath }
        if (product) await updateProduct(product.id, nextValues)
        else await createProduct(nextValues)
        toast.success(product ? 'Perubahan produk disimpan.' : 'Produk baru berhasil ditambahkan.')
        onSaved?.()
        if (!product) {
          const next = nextSku([...existingSkus, values.sku], 'Snack')
          setSkuValue(next)
          setSkuMode('automatic')
          setSkuError(null)
          setUnitIsOther(false)
          form.reset({ sku: next, unit_size: null, unit_label: null, unit_note: null, name: '', category: 'Snack', price: 10000, promo_price: null, stock: 0, extra_shipping_fee: 0, is_active: true, image_url: null, image_path: null, description: null })
        }
      } catch (error) {
        if (uploadedPath) await createClient().storage.from('product-images').remove([uploadedPath])
        toast.error(error instanceof Error ? error.message : 'Produk gagal disimpan.')
      }
    })
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 text-xs font-medium text-gray-300">
          <label htmlFor="product-sku">SKU</label>
          <input id="product-sku" className={fieldClass} value={skuValue} readOnly={!skuEditable || skuMode === 'automatic'} onChange={(event) => { const value = event.target.value.toUpperCase(); setSkuValue(value); form.setValue('sku', value, { shouldDirty: true, shouldValidate: true }); setSkuError(null) }} onBlur={() => { if (skuMode === 'manual' && skuEditable) void checkSkuUnique(skuValue) }} aria-describedby="sku-help" />
          {(!product || skuEditable) && <div className="flex min-h-10 gap-2" role="group" aria-label="Mode SKU">
            <button type="button" onClick={() => { setSkuMode('automatic'); const next = nextSku(existingSkus, form.getValues('category'), product?.sku); setSkuValue(next); form.setValue('sku', next, { shouldDirty: true, shouldValidate: true }); setSkuError(null) }} aria-pressed={skuMode === 'automatic'} className={`min-h-10 flex-1 rounded-lg border px-3 text-xs font-semibold ${skuMode === 'automatic' ? 'border-violet-400 bg-violet-500/15 text-white' : 'border-white/10 text-gray-400'}`}>Otomatis</button>
            <button type="button" onClick={() => { setSkuMode('manual'); setSkuError(null) }} aria-pressed={skuMode === 'manual'} className={`min-h-10 flex-1 rounded-lg border px-3 text-xs font-semibold ${skuMode === 'manual' ? 'border-violet-400 bg-violet-500/15 text-white' : 'border-white/10 text-gray-400'}`}>Manual</button>
          </div>}
          {product && !skuEditable && <button type="button" onClick={() => { setSkuEditable(true); setSkuMode('manual') }} className="min-h-10 self-start px-1 text-xs font-semibold text-blue-300 hover:text-blue-200">Ubah SKU</button>}
          {product && skuEditable && <p className="text-[11px] text-amber-200">Mengubah SKU memengaruhi pencatatan produk.</p>}
          <p id="sku-help" className="text-[11px] text-gray-500">Format: 2–4 huruf kapital, tanda hubung, minimal 3 angka.</p>
          {skuError && <span role="alert" className="text-rose-300">{skuError}</span>}
          {errors.sku && <span role="alert" className="text-rose-300">{errors.sku.message}</span>}
        </div>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-300">Nama produk
          <input className={fieldClass} maxLength={120} {...form.register('name')} placeholder="Contoh: Keripik singkong" />
          {errors.name && <span className="text-rose-300">{errors.name.message}</span>}
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-300">Kategori
          <select className={fieldClass} {...form.register('category', { onChange: (event) => updateAutomaticSku(event.target.value) })}><option value="Snack">Snack</option><option value="Minuman">Minuman</option></select>
        </label>
        <div className="flex flex-col gap-3 sm:col-span-2 sm:grid sm:grid-cols-2 sm:items-start">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-300">Ukuran/Isi (opsional)
            <input className={fieldClass} type="text" inputMode="decimal" placeholder="Contoh: 250 atau 1,5" {...form.register('unit_size', { setValueAs: (value) => { if (value === '' || value == null) return null; const parsed = Number(String(value).replace(',', '.')); return Number.isFinite(parsed) ? parsed : Number.NaN } })} />
            {errors.unit_size && <span role="alert" className="text-rose-300">{errors.unit_size.message}</span>}
          </label>
          <div className="flex flex-col gap-1.5 text-xs font-medium text-gray-300">
            <label htmlFor="unit-label">Satuan</label>
            <select id="unit-label" className={fieldClass} value={unitIsOther ? 'other' : form.watch('unit_label') ?? ''} onChange={(event) => {
              const value = event.target.value
              setUnitIsOther(value === 'other')
              form.setValue('unit_label', value === 'other' || !value ? null : value, { shouldDirty: true, shouldValidate: true })
            }}>
              <option value="">Pilih satuan</option>{unitOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}<option value="other">Lainnya</option>
            </select>
            {unitIsOther && <input className={fieldClass} type="text" maxLength={12} value={form.watch('unit_label') ?? ''} onChange={(event) => form.setValue('unit_label', event.target.value, { shouldDirty: true, shouldValidate: true })} placeholder="Tulis satuan (maks. 12 karakter)" aria-label="Satuan lainnya" />}
            {errors.unit_label && <span role="alert" className="text-rose-300">{errors.unit_label.message}</span>}
          </div>
          {form.watch('unit_size') !== null && form.watch('unit_size') !== undefined && Number.isFinite(form.watch('unit_size')) && Number(form.watch('unit_size')) > 0 && form.watch('unit_label') && <p className="text-xs text-gray-400 sm:col-span-2">Pratinjau: {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 6 }).format(Number(form.watch('unit_size')))} {form.watch('unit_label')}</p>}
          <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-300 sm:col-span-2">Keterangan isi (opsional)
            <input className={fieldClass} type="text" maxLength={120} placeholder="Contoh: isi 10 pcs atau 1 pack @ 15 gram" {...form.register('unit_note', { setValueAs: (value) => String(value ?? '').trim() || null })} />
            {errors.unit_note && <span role="alert" className="text-rose-300">{errors.unit_note.message}</span>}
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-300">Harga normal (Rp)
          <input className={fieldClass} type="number" min="1" step="1" {...form.register('price', { valueAsNumber: true })} />
          {errors.price && <span className="text-rose-300">{errors.price.message}</span>}
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-300">Harga promo (opsional)
          <input className={fieldClass} type="number" min="1" step="1" placeholder="Kosongkan jika tidak promo" {...form.register('promo_price', { setValueAs: (value) => value === '' ? null : Number(value) })} />
          {errors.promo_price && <span className="text-rose-300">{errors.promo_price.message}</span>}
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-300">Stok
          <input className={fieldClass} type="number" min="0" step="1" {...form.register('stock', { valueAsNumber: true })} />
          {errors.stock && <span className="text-rose-300">{errors.stock.message}</span>}
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-300">Ongkir tambahan per unit (Rp)
          <input className={fieldClass} type="number" min="0" step="500" {...form.register('extra_shipping_fee', { valueAsNumber: true })} />
          {errors.extra_shipping_fee && <span className="text-rose-300">{errors.extra_shipping_fee.message}</span>}
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-300 sm:col-span-2">Deskripsi
          <textarea className={`${fieldClass} min-h-20 py-3`} rows={2} maxLength={1000} {...form.register('description', { setValueAs: (value) => String(value ?? '').trim() || null })} placeholder="Deskripsi singkat untuk katalog" />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center overflow-hidden rounded-lg bg-white/5">{preview ? <Image src={preview} alt="Pratinjau foto produk" width={40} height={40} unoptimized className="size-10 object-cover" /> : <ImagePlus className="size-5 text-gray-400" />}</span>
          <span className="text-xs text-gray-300">Foto JPG/PNG/WebP · otomatis WebP maks. 2 MB</span>
        </div>
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold hover:bg-white/5">
          <ImagePlus className="size-4" /> Pilih foto
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => chooseImage(event.target.files?.[0])} />
        </label>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] px-3.5 py-3">
        <div><p className="text-sm font-medium text-white">Tampilkan di katalog</p><p className="mt-0.5 text-xs text-gray-400">SKU {skuValue}</p></div>
        <Switch checked={form.watch('is_active')} onCheckedChange={(checked) => form.setValue('is_active', checked, { shouldDirty: true })} aria-label="Produk aktif di katalog" />
      </div>
      {errors.root && <p role="alert" className="text-sm text-rose-300">{errors.root.message}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Batal</Button>}
        <Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : product ? 'Simpan perubahan' : 'Tambah produk'}</Button>
      </div>
    </form>
  )
}

function ProductManagerContent({ products }: { products: Product[] }) {
  const [editing, setEditing] = useState<Product | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const lowStock = products.filter((product) => product.stock <= 10).sort((a, b) => a.stock - b.stock)

  async function removeProduct(product: Product) {
    if (!window.confirm(`Hapus ${product.name} dari katalog?`)) return
    setBusyId(product.id)
    try {
      await deleteProduct(product.id)
      toast.success('Produk dihapus.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Produk gagal dihapus.')
    } finally {
      setBusyId(null)
    }
  }

  return <div className="flex flex-col gap-7">
    <section className="rounded-2xl border border-violet-400/15 bg-gradient-to-br from-blue-600/[.08] to-violet-600/[.08] p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><PackagePlus className="size-5" /></span><div><h3 className="font-display font-bold">Tambah produk</h3><p className="text-xs text-gray-400">SKU berikutnya mengikuti kategori, dan bisa diatur manual.</p></div></div>
      <ProductForm existingSkus={products.map((product) => product.sku)} />
    </section>
    <section>
      <h3 className="mb-3 font-display text-lg font-bold">Semua produk <span className="text-sm font-medium text-gray-500">({products.length})</span></h3>
      {products.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-400">Belum ada produk. Tambahkan produk pertama di atas.</div> : <div className="grid gap-4 xl:grid-cols-2">
        {products.map((product) => <article key={product.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#121218]">
          <div className="flex items-center gap-3 border-b border-white/5 p-4"><div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20">{product.image_url ? <Image src={product.image_url} alt={product.name} width={56} height={56} unoptimized className="size-14 object-cover" /> : <ImagePlus className="size-6 text-violet-200" />}</div><div className="min-w-0 flex-1"><h4 className="truncate font-semibold">{product.name}</h4><p className="text-xs text-violet-300">{product.sku} · {product.category} · {money(product.promo_price ?? product.price)} · Stok {product.stock}</p><p className="text-xs text-gray-500">{product.is_active ? 'Aktif di katalog' : 'Disembunyikan'}</p></div></div>
          <div className="flex items-center justify-end gap-2 p-3">
            <Dialog open={editing?.id === product.id} onOpenChange={(open) => { if (!open) setEditing(null); else setEditing(product) }}>
              <DialogTrigger render={<Button variant="outline" size="sm" onClick={() => setEditing(product)} />}><Pencil /> Edit</DialogTrigger>
              <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader><DialogTitle>Edit produk</DialogTitle><DialogDescription>Perbarui harga, promo, stok, foto, dan status katalog.</DialogDescription></DialogHeader>
                {editing?.id === product.id && <ProductErrorBoundary key={product.id}><ProductForm product={product} existingSkus={products.map((item) => item.sku)} onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} /></ProductErrorBoundary>}
              </DialogContent>
            </Dialog>
            <Button variant="destructive" size="sm" disabled={busyId === product.id} onClick={() => removeProduct(product)}><Trash2 /> Hapus</Button>
          </div>
        </article>)}
      </div>}
      {lowStock.length > 0 && <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">Perhatian: {lowStock.length} produk memiliki stok 10 atau kurang.</p>}
    </section>
  </div>
}

class ProductErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[admin] Product page failed to render:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <section role="alert" className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-5 text-rose-100">
          <h3 className="font-semibold">Halaman Produk mengalami kendala</h3>
          <p className="mt-2 text-sm text-rose-200">{this.state.error.message || 'Terjadi kesalahan saat menampilkan data atau formulir produk.'}</p>
          <button type="button" className="mt-4 min-h-10 rounded-lg border border-rose-300/30 px-3 text-sm font-semibold hover:bg-rose-400/10" onClick={() => this.setState({ error: null })}>
            Coba lagi
          </button>
        </section>
      )
    }

    return this.props.children
  }
}

export function ProductManager({ products }: { products: Product[] }) {
  return <ProductErrorBoundary><ProductManagerContent products={products} /></ProductErrorBoundary>
}
