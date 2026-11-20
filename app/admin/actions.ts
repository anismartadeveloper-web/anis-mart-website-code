'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { productSchema, storeSettingsSchema, type ProductInput, type StoreSettingsInput } from '@/lib/store/validation'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).maybeSingle()
  if (profile?.is_active === false) redirect('/akun-nonaktif')
  if (profile?.role !== 'admin') redirect('/')
  return supabase
}

function validId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

async function removeStoredImage(supabase: Awaited<ReturnType<typeof createClient>>, path: string | null) {
  if (!path) return
  const { error } = await supabase.storage.from('product-images').remove([path])
  if (error) console.error('[admin] Product image cleanup failed:', error.message)
}

export async function createProduct(input: ProductInput) {
  const supabase = await requireAdmin()
  const parsed = productSchema.safeParse(input)
  if (!parsed.success) throw new Error('Data produk tidak valid. Periksa harga, promo, kategori, dan stok.')
  const { error } = await supabase.from('products').insert(parsed.data)
  if (error) throw new Error(`Produk gagal disimpan: ${error.message}`)
  revalidatePath('/admin')
  revalidatePath('/')
}

export async function updateProduct(id: string, input: ProductInput) {
  const supabase = await requireAdmin()
  if (!validId(id)) throw new Error('ID produk tidak valid.')
  const parsed = productSchema.safeParse(input)
  if (!parsed.success) throw new Error('Data produk tidak valid. Periksa harga, promo, kategori, dan stok.')
  const { data: current } = await supabase.from('products').select('image_path').eq('id', id).maybeSingle()
  const { error } = await supabase.from('products').update(parsed.data).eq('id', id)
  if (error) throw new Error(`Perubahan produk gagal disimpan: ${error.message}`)
  if (current?.image_path && current.image_path !== parsed.data.image_path) await removeStoredImage(supabase, current.image_path)
  revalidatePath('/admin')
  revalidatePath('/')
}

export async function deleteProduct(id: string) {
  const supabase = await requireAdmin()
  if (!validId(id)) throw new Error('ID produk tidak valid.')
  const { data: current } = await supabase.from('products').select('image_path').eq('id', id).maybeSingle()
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw new Error(`Produk gagal dihapus: ${error.message}`)
  await removeStoredImage(supabase, current?.image_path ?? null)
  revalidatePath('/admin')
  revalidatePath('/')
}

export async function updateStoreSettings(input: StoreSettingsInput) {
  const supabase = await requireAdmin()
  const parsed = storeSettingsSchema.safeParse(input)
  if (!parsed.success) throw new Error('Pengaturan toko tidak valid. Periksa alamat, lokasi, dan tarif.')
  const { error } = await supabase.from('store_settings').upsert({ id: true, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) throw new Error(`Pengaturan gagal disimpan: ${error.message}`)
  revalidatePath('/admin')
  revalidatePath('/')
}

export async function updatePaymentMethodActive(id: string, active: boolean) {
  const supabase = await requireAdmin()
  if (!['cod', 'dana', 'gopay', 'shopeepay', 'ovo'].includes(id) || typeof active !== 'boolean') throw new Error('Metode pembayaran tidak valid.')
  const { error } = await supabase.from('payment_methods').update({ is_active: active }).eq('id', id)
  if (error) throw new Error(error.message.includes('Minimal satu metode') ? error.message : `Metode pembayaran gagal diperbarui: ${error.message}`)
  revalidatePath('/admin')
  revalidatePath('/')
}

export async function updateOrderStatus(formData: FormData) {
  const supabase = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!validId(id) || !['pending', 'diproses', 'selesai', 'dibatalkan'].includes(status)) throw new Error('Status pesanan tidak valid.')
  if (status === 'dibatalkan') {
    const { error } = await supabase.rpc('cancel_order', { p_order_id: id })
    if (error) throw new Error(`Pesanan gagal dibatalkan: ${error.message}`)
  } else {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id)
    if (error) throw new Error(`Status pesanan gagal diperbarui: ${error.message}`)
  }
  revalidatePath('/admin')
  revalidatePath('/pesanan-saya')
}

export async function setCustomerActive(formData: FormData) {
  const supabase = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const isActive = String(formData.get('is_active') ?? '') === 'true'
  if (!validId(id)) throw new Error('ID pelanggan tidak valid.')
  const { data: target } = await supabase.from('profiles').select('role').eq('id', id).maybeSingle()
  if (target?.role !== 'user') throw new Error('Hanya akun pelanggan yang dapat diubah.')
  const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id)
  if (error) throw new Error(`Status akun gagal diperbarui: ${error.message}`)
  revalidatePath('/admin')
}
